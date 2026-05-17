import { Injectable, Logger } from "@nestjs/common";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "dev-disabled";
// 4 attempts = initial send + up to 3 retries (1s / 2s / 4s backoff stages)
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_000;
const MAX_DELAY_MS = 30_000;

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    // fetch() throws TypeError for network failures (DNS, TLS, timeout, reset)
    if (
      err instanceof TypeError &&
      !err.message.startsWith("Telegram API error")
    )
      return true;
    // Parse status code from error message "Telegram API error 500: ..."
    const match = err.message.match(/^Telegram API error (\d+)/);
    if (match) {
      const status = parseInt(match[1], 10);
      // Retry on server errors (5xx) and rate limiting (429)
      return status >= 500 || status === 429;
    }
  }
  return false;
}

function computeDelay(attempt: number): number {
  const base = RETRY_BASE_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * base * 0.25);
  return Math.min(base + jitter, MAX_DELAY_MS);
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;

  /**
   * Send a message with optional HTML formatting and inline keyboard.
   * Telegram supports HTML parse_mode: <b>bold</b>, <i>italic</i>, <code>code</code>, etc.
   */
  async send(
    chatId: string,
    text: string,
    options?: {
      title?: string;
      viewUrl?: string;
      viewLabel?: string;
    },
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`Telegram disabled — skipping message to ${chatId}`);
      return;
    }

    // Build HTML message with optional bold title
    let htmlMessage = text;
    if (options?.title) {
      htmlMessage = `<b>${options.title}</b>\n\n${text}`;
    }

    // Build request body with parse_mode and optional inline keyboard
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: htmlMessage,
      parse_mode: "HTML",
    };

    // Add inline keyboard with "View on Polyforge" button if URL provided
    if (options?.viewUrl) {
      body.reply_markup = {
        inline_keyboard: [
          [
            {
              text: options.viewLabel ?? "View on Polyforge",
              url: options.viewUrl,
            },
          ],
        ],
      };
    }

    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

    let lastError: unknown;

    // NOTE: Retrying on network errors carries a small risk of duplicate
    // delivery if Telegram accepted the message but the HTTP response was
    // lost. The Telegram Bot API does not provide idempotency keys, so this
    // tradeoff favours reliability over strict at-most-once semantics.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const responseBody = await res.text();
          const err = new Error(
            `Telegram API error ${res.status}: ${responseBody}`,
          );
          // Honour Telegram's retry_after hint on 429 responses
          if (res.status === 429) {
            try {
              const parsed = JSON.parse(responseBody);
              if (parsed.parameters?.retry_after) {
                (err as any).retryAfter = parsed.parameters.retry_after;
              }
            } catch {
              /* ignore parse errors — fall back to exponential backoff */
            }
          }
          throw err;
        }

        this.logger.log(`Telegram message sent to chatId ${chatId}`);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS && isTransientError(err)) {
          let delay: number;
          const retryAfterRaw = (err as any).retryAfter;
          if (retryAfterRaw != null) {
            const seconds = Number(retryAfterRaw);
            delay =
              Number.isFinite(seconds) && seconds > 0
                ? Math.min(seconds * 1000, MAX_DELAY_MS)
                : computeDelay(attempt);
          } else {
            delay = computeDelay(attempt);
          }
          this.logger.warn(
            `Telegram send attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${delay}ms`,
          );
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
