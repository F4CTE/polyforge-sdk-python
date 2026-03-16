import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CommandsService } from './commands.service';
import { LinkingService } from './linking.service';

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? 'dev-disabled';

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
    private readonly enabled = TOKEN !== 'dev-disabled' && TOKEN.length > 0;
    private client: any = null; // discord.js Client — lazy-imported

    constructor(
        private readonly commands: CommandsService,
        private readonly linking: LinkingService,
    ) {}

    async onModuleInit() {
        if (!this.enabled) {
            this.logger.log('Discord bot disabled (DISCORD_BOT_TOKEN=dev-disabled)');
            return;
        }

        try {
            const { Client, GatewayIntentBits, Events } = await import('discord.js');

            this.client = new Client({
                intents: [
                    GatewayIntentBits.DirectMessages,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                ],
            });

            this.client.on(Events.MessageCreate, async (message: any) => {
                // Ignore bot messages and non-command messages
                if (message.author.bot) return;
                const text = String(message.content ?? '').trim();
                if (!text.startsWith('/')) return;

                // For DMs, channelId == the DM channel ID — what we store and send to
                const channelId = message.channel.id;
                const isDm      = message.channel.type === 1; // ChannelType.DM

                if (!isDm) {
                    // Only accept commands in DMs for now
                    return;
                }

                try {
                    const reply = await this.dispatchDiscord(channelId, text);
                    await message.reply(reply);
                } catch (err: any) {
                    this.logger.error(`Discord command error: ${err?.message}`);
                    await message.reply('⚠️ An error occurred. Please try again.');
                }
            });

            this.client.once(Events.ClientReady, (c: any) => {
                this.logger.log(`Discord bot ready as ${c.user.tag}`);
            });

            await this.client.login(TOKEN);
        } catch (err: any) {
            this.logger.error(`Discord bot failed to start: ${err?.message}`);
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            try { await this.client.destroy(); } catch { /* ignore */ }
        }
    }

    // ─── Send a message to a DM channel ──────────────────────────────────────

    async send(channelId: string, content: string): Promise<void> {
        if (!this.enabled || !this.client) return;
        try {
            const channel = await this.client.channels.fetch(channelId);
            await channel.send(content);
        } catch (err: any) {
            this.logger.error(`Discord send failed: ${err?.message}`);
        }
    }

    // ─── Command dispatch ─────────────────────────────────────────────────────

    private async dispatchDiscord(channelId: string, text: string): Promise<string> {
        const [cmd, ...rest] = text.trim().split(/\s+/);
        const arg = rest.join(' ').trim();

        if (cmd === '/start') {
            return [
                '👋 Welcome to **Polyforge Bot**!',
                '',
                'To get started, link your Polyforge account:',
                '1. Go to **Settings → Bots** in the Polyforge app',
                '2. Click **Connect Discord** to get your 6-digit code',
                '3. Send `/connect YOUR_CODE` here',
                '',
                'Type `/help` after linking to see all commands.',
            ].join('\n');
        }

        if (cmd === '/help') {
            return await this.commands.execute('userId-not-needed', '/help');
        }

        if (cmd === '/connect') {
            if (!arg) return '⚠️ Usage: `/connect <6-digit code>`';
            return this.linking.connect('DISCORD', channelId, arg);
        }

        if (cmd === '/disconnect') {
            return this.linking.disconnect('DISCORD', channelId);
        }

        const userId = await this.linking.getUserId('DISCORD', channelId);
        if (!userId) {
            return '🔗 Please link your account first.\nSend `/start` for instructions.';
        }

        return this.commands.execute(userId, text);
    }
}
