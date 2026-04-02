import { Injectable, Logger } from "@nestjs/common";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "dev-disabled";

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;

  /** Severity-to-color mapping for Discord embeds */
  private static readonly SEVERITY_COLORS: Record<string, number> = {
    success: 0x22c55e, // green
    error: 0xef4444, // red
    warning: 0xf59e0b, // amber
    info: 0x06b6d4, // cyan (default)
  };

  /**
   * Send a DM to a Discord user using a rich embed.
   * chatId stored in bot_connections is the DM channel ID (opened during bot linking).
   *
   * @param channelId - Discord DM channel ID
   * @param content   - Main message body (used as embed description)
   * @param options   - Optional embed customisation (title, severity for color coding)
   */
  async send(
    channelId: string,
    content: string,
    options?: {
      title?: string;
      severity?: "success" | "error" | "warning" | "info";
    },
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Discord disabled — skipping message to channel ${channelId}`,
      );
      return;
    }

    const severity = options?.severity ?? "info";
    const color =
      DiscordService.SEVERITY_COLORS[severity] ??
      DiscordService.SEVERITY_COLORS.info;

    const embed: Record<string, unknown> = {
      description: content,
      color,
      footer: {
        text: `Polyforge · ${new Date().toISOString()}`,
      },
    };

    if (options?.title) {
      embed.title = options.title;
    }

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${TOKEN}`,
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord API error ${res.status}: ${body}`);
    }

    this.logger.log(`Discord embed sent to channel ${channelId}`);
  }
}
