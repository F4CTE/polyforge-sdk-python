import { Injectable, Logger } from "@nestjs/common";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "dev-disabled";

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
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.text();
      throw new Error(`Telegram API error ${res.status}: ${responseBody}`);
    }

    this.logger.log(`Telegram message sent to chatId ${chatId}`);
  }
}
