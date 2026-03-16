import { Injectable, Logger } from '@nestjs/common';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? 'dev-disabled';

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly enabled = TOKEN !== 'dev-disabled' && TOKEN.length > 0;

    async send(chatId: string, text: string): Promise<void> {
        if (!this.enabled) {
            this.logger.debug(`Telegram disabled — skipping message to ${chatId}`);
            return;
        }

        const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Telegram API error ${res.status}: ${body}`);
        }

        this.logger.log(`Telegram message sent to chatId ${chatId}`);
    }
}
