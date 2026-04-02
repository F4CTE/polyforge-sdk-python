import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { emailLayout } from './email-layout';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor() {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL;
    if (!fromEmail)
      throw new Error('AWS_SES_FROM_EMAIL environment variable is required');
    if (!process.env.FRONTEND_URL)
      throw new Error('FRONTEND_URL environment variable is required');
    this.from = `Polyforge <${fromEmail}>`;
    this.frontendUrl = process.env.FRONTEND_URL;
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
    const base = this.frontendUrl;
    const url = `${base}/verify-email?token=${token}`;

    const html = emailLayout({
      preheader:
        'Verify your email address to activate your Polyforge account.',
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
      footerNote:
        'You received this because someone signed up for Polyforge with this email address.',
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

  async sendWaitlistConfirmationEmail(to: string): Promise<void> {
    const base = this.frontendUrl;

    const html = emailLayout({
      preheader: "You're on the Polyforge waitlist — we'll be in touch soon.",
      body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  You're on the list!
                </h2>
                <p style="margin:0 0 16px;color:#4b5563">
                  Thanks for signing up for early access to Polyforge. You're in the queue — we're
                  rolling out invites in waves and will email your personal invite code as soon as
                  your spot opens up.
                </p>
                <p style="margin:0 0 28px;color:#4b5563">
                  In the meantime, take a look at what Polyforge can do:
                </p>
                <p style="text-align:center;margin:0 0 28px">
                  <a href="${base}"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Learn more
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  If you didn't sign up for Polyforge early access, you can safely ignore this email.
                </p>
            `,
      footerNote:
        'You received this because you joined the Polyforge early-access waitlist.',
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "You're on the Polyforge waitlist",
      text: `You're on the Polyforge early-access waitlist!\n\nWe'll email your personal invite code as soon as your spot opens up.\n\nVisit ${base} to learn more.\n\nIf you didn't sign up, you can ignore this email.`,
      html,
    });
    this.logger.log(`Waitlist confirmation email sent to ${to}`);
  }

  async sendPendingApprovalEmail(to: string, username: string): Promise<void> {
    const base = this.frontendUrl;

    const html = emailLayout({
      preheader:
        "Your Polyforge account is pending approval — we'll notify you once approved.",
      body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  Welcome to the beta waitlist, ${username}!
                </h2>
                <p style="margin:0 0 16px;color:#4b5563">
                  Your Polyforge account has been created and is pending approval.
                  We're reviewing applications for beta access and will notify you
                  by email as soon as your account is approved.
                </p>
                <p style="margin:0 0 16px;color:#4b5563">
                  In the meantime, you can verify your email address to speed up
                  the approval process.
                </p>
                <p style="text-align:center;margin:0 0 28px">
                  <a href="${base}"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Visit Polyforge
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  You'll receive another email once your account is approved.
                </p>
            `,
      footerNote:
        'You received this because you registered for a Polyforge beta account.',
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your Polyforge account is pending approval',
      text: `Welcome ${username}! Your Polyforge account is pending approval. We'll email you once your beta access is approved.\n\nVisit ${base} to learn more.`,
      html,
    });
    this.logger.log(`Pending approval email sent to ${to}`);
  }

  async sendAccountApprovedEmail(to: string, username: string): Promise<void> {
    const base = this.frontendUrl;
    const loginUrl = `${base}/login`;

    const html = emailLayout({
      preheader:
        'Your Polyforge beta access has been approved — you can now sign in!',
      body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  You're in, ${username}! 🎉
                </h2>
                <p style="margin:0 0 16px;color:#4b5563">
                  Your Polyforge account has been approved for beta access!
                  You can now sign in and start building automated trading strategies
                  on prediction markets.
                </p>
                <p style="text-align:center;margin:0 0 28px">
                  <a href="${loginUrl}"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Sign in to Polyforge
                  </a>
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  Welcome to the Polyforge beta. Happy trading!
                </p>
            `,
      footerNote:
        'You received this because your Polyforge beta application was approved.',
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "You're approved! Welcome to Polyforge beta 🎉",
      text: `Welcome ${username}! Your Polyforge beta access has been approved. Sign in at ${loginUrl} to get started.`,
      html,
    });
    this.logger.log(`Account approved email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const base = this.frontendUrl;
    const url = `${base}/reset-password?token=${token}`;

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
      footerNote:
        'You received this because a password reset was requested for your Polyforge account.',
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
