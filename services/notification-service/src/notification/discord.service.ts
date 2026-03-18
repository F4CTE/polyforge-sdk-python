import { Injectable, Logger } from "@nestjs/common";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "dev-disabled";

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly enabled = TOKEN !== "dev-disabled" && TOKEN.length > 0;

  /**
   * Send a DM to a Discord user.
   * chatId stored in bot_connections is the DM channel ID (opened during bot linking).
   */
  async send(channelId: string, content: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Discord disabled — skipping message to channel ${channelId}`,
      );
      return;
    }

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${TOKEN}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord API error ${res.status}: ${body}`);
    }

    this.logger.log(`Discord message sent to channel ${channelId}`);
  }
}
