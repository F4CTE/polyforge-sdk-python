import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { CommandsService } from "./commands.service";
import { LinkingService } from "./linking.service";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "dev-disabled";
const API = `https://api.telegram.org/bot${TOKEN}`;
const TIMEOUT = 30; // long-poll timeout (seconds)

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;
  private running = false;
  private offset = 0;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly commands: CommandsService,
    private readonly linking: LinkingService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        "Telegram bot disabled (TELEGRAM_BOT_TOKEN=dev-disabled)",
      );
      return;
    }
    this.running = true;
    this.loopPromise = this.pollLoop();
    this.logger.log("Telegram bot started (long-polling)");
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loopPromise;
  }

  // ─── Send a message to a chat ─────────────────────────────────────────────

  async send(chatId: string, text: string): Promise<void> {
    if (!this.enabled) return;
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  }

  // ─── Long-polling loop ────────────────────────────────────────────────────

  private async pollLoop() {
    while (this.running) {
      try {
        const res = await fetch(
          `${API}/getUpdates?offset=${this.offset}&timeout=${TIMEOUT}&allowed_updates=["message"]`,
          { signal: AbortSignal.timeout((TIMEOUT + 5) * 1000) },
        );

        if (!res.ok) {
          this.logger.warn(`getUpdates error ${res.status}`);
          await this.sleep(2000);
          continue;
        }

        const data: any = await res.json();
        if (!data.ok) continue;

        for (const update of data.result ?? []) {
          this.offset = update.update_id + 1;
          const msg = update.message;
          if (!msg?.text) continue;

          const chatId = String(msg.chat.id);
          const text = String(msg.text).trim();

          if (!text.startsWith("/")) continue;

          try {
            const reply = await this.dispatch(chatId, text);
            await this.send(chatId, reply);
          } catch (err: any) {
            this.logger.error(`Telegram command error: ${err?.message}`);
            await this.send(chatId, "⚠️ An error occurred. Please try again.");
          }
        }
      } catch (err: any) {
        if (this.running) {
          this.logger.error(`Poll error: ${err?.message}`);
          await this.sleep(3000);
        }
      }
    }
  }

  private async dispatch(chatId: string, text: string): Promise<string> {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(" ").trim();

    // Commands that work without a linked account
    if (cmd === "/start") {
      return [
        "👋 Welcome to <b>Polyforge Bot</b>!",
        "",
        "To get started, link your Polyforge account:",
        "1. Go to <b>Settings → Bots</b> in the Polyforge app",
        "2. Click <b>Connect Telegram</b> to get your 6-digit code",
        "3. Send <code>/connect YOUR_CODE</code> here",
        "",
        "Type /help after linking to see all commands.",
      ].join("\n");
    }

    if (cmd === "/help") {
      return await this.commands.execute("userId-not-needed", "/help");
    }

    if (cmd === "/connect") {
      if (!arg) return "⚠️ Usage: /connect <6-digit code>";
      return this.linking.connect("TELEGRAM", chatId, arg);
    }

    if (cmd === "/disconnect") {
      return this.linking.disconnect("TELEGRAM", chatId);
    }

    // All other commands require a linked account
    const userId = await this.linking.getUserId("TELEGRAM", chatId);
    if (!userId) {
      return "🔗 Please link your account first:\nSend /start for instructions.";
    }

    return this.commands.execute(userId, text);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
