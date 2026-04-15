import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import type { Client as DiscordClient, Message, DMChannel } from "discord.js";
import { CommandsService } from "./commands.service";
import { LinkingService } from "./linking.service";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "dev-disabled";

/**
 * Discord bot using discord.js.
 * Only initialises when DISCORD_BOT_TOKEN is set and not 'dev-disabled'.
 *
 * Commands are handled via DMs only: users must DM the bot.
 * The chatId stored in bot_connections is the DM channel ID.
 */
@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordService.name);
  private readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;
  // discord.js Client — lazy-imported at runtime to avoid module load cost
  private client: DiscordClient | null = null;

  constructor(
    private readonly commands: CommandsService,
    private readonly linking: LinkingService,
  ) {}

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Discord bot disabled (DISCORD_BOT_TOKEN=dev-disabled)");
      return;
    }

    try {
      const { Client, GatewayIntentBits, Events } = await import("discord.js");

      this.client = new Client({
        intents: [
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });
      const client = this.client;

      client.on(Events.MessageCreate, (message: Message): void => {
        // Ignore bot messages and non-command messages
        if (message.author.bot) return;
        const text = String(message.content ?? "").trim();
        if (!text.startsWith("/")) return;

        // For DMs, channelId == the DM channel ID — what we store and send to
        const channelId = message.channelId;
        const isDm = message.channel.isDMBased();

        if (!isDm) {
          // Only accept commands in DMs for now
          return;
        }

        const handleMessage = async (): Promise<void> => {
          try {
            const reply = await this.dispatchDiscord(channelId, text);
            await message.reply(reply);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Discord command error: ${errMsg}`);
            await message.reply("⚠️ An error occurred. Please try again.");
          }
        };
        void handleMessage();
      });

      client.once(Events.ClientReady, (c: DiscordClient<true>) => {
        this.logger.log(`Discord bot ready as ${c.user.tag}`);
      });

      await client.login(TOKEN);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Discord bot failed to start: ${errMsg}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        /* ignore */
      }
    }
  }

  // ─── Send a message to a DM channel ──────────────────────────────────────

  async send(channelId: string, content: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;
      await (channel as DMChannel).send(content);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Discord send failed: ${errMsg}`);
    }
  }

  // ─── Command dispatch ─────────────────────────────────────────────────────

  private async dispatchDiscord(
    channelId: string,
    text: string,
  ): Promise<string> {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(" ").trim();

    if (cmd === "/start") {
      return [
        "👋 Welcome to **Polyforge Bot**!",
        "",
        "To get started, link your Polyforge account:",
        "1. Go to **Settings → Bots** in the Polyforge app",
        "2. Click **Connect Discord** to get your 6-digit code",
        "3. Send `/connect YOUR_CODE` here",
        "",
        "Type `/help` after linking to see all commands.",
      ].join("\n");
    }

    if (cmd === "/help") {
      return await this.commands.execute("userId-not-needed", "/help");
    }

    if (cmd === "/connect") {
      if (!arg) return "⚠️ Usage: `/connect <6-digit code>`";
      return this.linking.connect("DISCORD", channelId, arg);
    }

    if (cmd === "/disconnect") {
      return this.linking.disconnect("DISCORD", channelId);
    }

    const userId = await this.linking.getUserId("DISCORD", channelId);
    if (!userId) {
      return "🔗 Please link your account first.\nSend `/start` for instructions.";
    }

    return this.commands.execute(userId, text);
  }
}
