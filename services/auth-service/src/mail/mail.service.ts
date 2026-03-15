import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor() {
        this.from = process.env.AWS_SES_FROM_EMAIL ?? 'noreply@polyforge.app';
        const driver = process.env.EMAIL_DRIVER ?? 'mailhog';

        if (driver === 'mailhog') {
            this.transporter = nodemailer.createTransport({
                host: process.env.MAILHOG_HOST ?? 'localhost',
                port: parseInt(process.env.MAILHOG_PORT ?? '1025', 10),
                secure: false,
                ignoreTLS: true,
            } as any);
        } else {
            // SES via SMTP (production)
            this.transporter = nodemailer.createTransport({
                host: `email-smtp.${process.env.AWS_SES_REGION ?? 'us-east-1'}.amazonaws.com`,
                port: 587,
                secure: false,
                auth: {
                    user: process.env.AWS_SES_SMTP_USER,
                    pass: process.env.AWS_SES_SMTP_PASSWORD,
                },
            });
        }
    }

    async sendVerificationEmail(to: string, token: string): Promise<void> {
        const base = process.env.FRONTEND_URL ?? 'https://localhost';
        const url = `${base}/verify-email?token=${token}`;
        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Verify your Polyforge account',
            text: `Click the link to verify your email:\n\n${url}\n\nThis link expires in 24 hours.`,
            html: `<p>Click the link to verify your email address:</p>
<p><a href="${url}">${url}</a></p>
<p>This link expires in 24 hours. If you did not create a Polyforge account, you can safely ignore this email.</p>`,
        });
        this.logger.log(`Verification email sent to ${to}`);
    }

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const base = process.env.FRONTEND_URL ?? 'https://localhost';
        const url = `${base}/reset-password?token=${token}`;
        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Reset your Polyforge password',
            text: `Click the link to reset your password:\n\n${url}\n\nThis link expires in 1 hour.`,
            html: `<p>Click the link to reset your password:</p>
<p><a href="${url}">${url}</a></p>
<p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>`,
        });
        this.logger.log(`Password reset email sent to ${to}`);
    }
}
