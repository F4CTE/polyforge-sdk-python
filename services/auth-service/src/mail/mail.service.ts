import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { emailLayout } from './email-layout';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter: nodemailer.Transporter;
    private readonly from: string;

    constructor() {
        this.from = `Polyforge <${process.env.AWS_SES_FROM_EMAIL ?? 'noreply@polyforge.app'}>`;
        const driver = process.env.EMAIL_DRIVER ?? 'mailhog';

        if (driver === 'mailhog') {
            this.transporter = nodemailer.createTransport({
                host: process.env.MAILHOG_HOST ?? 'localhost',
                port: parseInt(process.env.MAILHOG_PORT ?? '1025', 10),
                secure: false,
                ignoreTLS: true,
            } as any);
        } else {
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
        const base = process.env.FRONTEND_URL ?? 'https://polyforge.app';
        const url  = `${base}/verify-email?token=${token}`;

        const html = emailLayout({
            preheader: 'Verify your email address to activate your Polyforge account.',
            body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  Verify your email address
                </h2>
                <p style="margin:0 0 24px;color:#4b5563">
                  Thanks for signing up to Polyforge. Click the button below to confirm your
                  email address and activate your account. This link expires in
                  <strong>24 hours</strong>.
                </p>
                <p style="text-align:center;margin:0 0 28px">
                  <a href="${url}" class="btn-primary"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Verify my email
                  </a>
                </p>
                <p style="margin:0;font-size:13px;color:#6b7280">
                  Or copy this link into your browser:<br/>
                  <a href="${url}" style="color:#06b6d4;word-break:break-all">${url}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  If you did not create a Polyforge account, you can safely ignore this email.
                </p>
            `,
            footerNote: 'You received this because someone signed up for Polyforge with this email address.',
        });

        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Verify your Polyforge account',
            text: `Verify your Polyforge email address.\n\nClick the link below:\n\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, ignore this email.`,
            html,
        });
        this.logger.log(`Verification email sent to ${to}`);
    }

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        const base = process.env.FRONTEND_URL ?? 'https://polyforge.app';
        const url  = `${base}/reset-password?token=${token}`;

        const html = emailLayout({
            preheader: 'Reset your Polyforge password — link expires in 1 hour.',
            body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  Reset your password
                </h2>
                <p style="margin:0 0 24px;color:#4b5563">
                  We received a request to reset the password for your Polyforge account.
                  Click the button below to choose a new password. This link expires in
                  <strong>1 hour</strong>.
                </p>
                <p style="text-align:center;margin:0 0 28px">
                  <a href="${url}" class="btn-primary"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Reset my password
                  </a>
                </p>
                <p style="margin:0;font-size:13px;color:#6b7280">
                  Or copy this link into your browser:<br/>
                  <a href="${url}" style="color:#06b6d4;word-break:break-all">${url}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  If you did not request a password reset, you can safely ignore this email.
                  Your password will not be changed.
                </p>
            `,
            footerNote: 'You received this because a password reset was requested for your Polyforge account.',
        });

        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: 'Reset your Polyforge password',
            text: `Reset your Polyforge password.\n\nClick the link below:\n\n${url}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
            html,
        });
        this.logger.log(`Password reset email sent to ${to}`);
    }
}
