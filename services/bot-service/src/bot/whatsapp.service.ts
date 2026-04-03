import {
  Injectable,
  Logger,
  OnModuleInit,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { CommandsService } from "./commands.service";
import { LinkingService } from "./linking.service";

const TOKEN = process.env.WHATSAPP_TOKEN ?? "dev-disabled";
const PHONE_ID = process.env.WHATSAPP_PHONE_ID ?? "";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
const API_URL = `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`;

/**
 * WhatsApp bot using the WhatsApp Business Cloud API (Meta).
 *
 * Only initialises when WHATSAPP_TOKEN is set and not 'dev-disabled'.
 *
 * Webhook endpoints:
 *   GET  /webhook/whatsapp  — Webhook verification (Meta challenge)
 *   POST /webhook/whatsapp  — Incoming message handler
 */
@Injectable()
@Controller()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;

  constructor(
    private readonly commands: CommandsService,
    private readonly linking: LinkingService,
  ) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log("WhatsApp bot disabled (WHATSAPP_TOKEN=dev-disabled)");
      return;
    }
    this.logger.log("WhatsApp bot enabled — webhook at /webhook/whatsapp");
  }

  // ─── Webhook verification (GET) ────────────────────────────────────────────

  handleVerification(query: {
    "hub.mode"?: string;
    "hub.verify_token"?: string;
    "hub.challenge"?: string;
  }): { status: number; body: string } {
    if (!VERIFY_TOKEN) {
      this.logger.warn(
        "WhatsApp webhook verification rejected — WHATSAPP_VERIFY_TOKEN not configured",
      );
      return { status: 403, body: "Forbidden" };
    }

    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      this.logger.log("WhatsApp webhook verified");
      return { status: 200, body: challenge ?? "" };
    }

    this.logger.warn("WhatsApp webhook verification failed");
    return { status: 403, body: "Forbidden" };
  }

  // ─── Incoming message handler (POST) ───────────────────────────────────────

  async handleIncoming(body: any): Promise<void> {
    if (!this.enabled) return;

    const entries = body?.entry ?? [];
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.messages) continue;

        for (const message of value.messages) {
          if (message.type !== "text") continue;

          const from = String(message.from); // sender phone number
          const text = String(message.text?.body ?? "").trim();

          if (!text.startsWith("/")) continue;

          try {
            const reply = await this.dispatch(from, text);
            await this.send(from, reply);
          } catch (err: any) {
            this.logger.error(`WhatsApp command error: ${err?.message}`);
            await this.send(from, "⚠️ An error occurred. Please try again.");
          }
        }
      }
    }
  }

  // ─── Send a message via Cloud API ──────────────────────────────────────────

  async send(to: string, text: string): Promise<void> {
    if (!this.enabled) return;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      });

      if (!res.ok) {
        this.logger.warn(`WhatsApp send failed ${res.status}`);
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp send error: ${err?.message}`);
    }
  }

  // ─── Command dispatch ─────────────────────────────────────────────────────

  private async dispatch(from: string, text: string): Promise<string> {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(" ").trim();

    // Commands that work without a linked account
    if (cmd === "/start") {
      return [
        "👋 Welcome to *Polyforge Bot*!",
        "",
        "To get started, link your Polyforge account:",
        "1. Go to *Settings → Bots* in the Polyforge app",
        "2. Click *Connect WhatsApp* to get your 6-digit code",
        "3. Send /connect YOUR_CODE here",
        "",
        "Type /help after linking to see all commands.",
      ].join("\n");
    }

    if (cmd === "/help") {
      return await this.commands.execute("userId-not-needed", "/help");
    }

    if (cmd === "/connect") {
      if (!arg) return "⚠️ Usage: /connect <6-digit code>";
      return this.linking.connect("WHATSAPP", from, arg);
    }

    if (cmd === "/disconnect") {
      return this.linking.disconnect("WHATSAPP", from);
    }

    // All other commands require a linked account
    const userId = await this.linking.getUserId("WHATSAPP", from);
    if (!userId) {
      return "🔗 Please link your account first.\nSend /start for instructions.";
    }

    return this.commands.execute(userId, text);
  }

  // ─── Template messages ──────────────────────────────────────────────────────

  /**
   * Send a pre-approved WhatsApp message template.
   *
   * IMPORTANT: WhatsApp Business API requires message templates to be
   * pre-approved by Meta before they can be used for proactive (business-initiated)
   * messages. Free-form text messages are only allowed within a 24-hour window
   * after the user last messaged the bot.
   *
   * Templates must be created and approved in the Meta Business Manager at:
   *   https://business.facebook.com/wa/manage/message-templates/
   *
   * @param phoneNumber - Recipient phone number in international format (e.g. "14155551234")
   * @param templateName - The approved template name (e.g. "order_update", "price_alert")
   * @param params - Positional parameters that fill {{1}}, {{2}}, etc. placeholders in the template
   * @param languageCode - Template language code (default: "en_US")
   */
  async sendTemplate(
    phoneNumber: string,
    templateName: string,
    params: string[],
    languageCode = "en_US",
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components:
              params.length > 0
                ? [
                    {
                      type: "body",
                      parameters: params.map((text) => ({
                        type: "text",
                        text,
                      })),
                    },
                  ]
                : [],
          },
        }),
      });

      if (!res.ok) {
        this.logger.warn(`WhatsApp template send failed ${res.status}`);
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp template send error: ${err?.message}`);
    }
  }

  // ─── Static helpers for parsing ────────────────────────────────────────────

  /**
   * Extract messages from a WhatsApp webhook payload.
   * Useful for testing and external consumers.
   */
  static parseWebhookMessages(
    body: any,
  ): Array<{ from: string; text: string }> {
    const result: Array<{ from: string; text: string }> = [];
    const entries = body?.entry ?? [];
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        if (!value?.messages) continue;
        for (const message of value.messages) {
          if (message.type !== "text") continue;
          result.push({
            from: String(message.from),
            text: String(message.text?.body ?? ""),
          });
        }
      }
    }
    return result;
  }
}
