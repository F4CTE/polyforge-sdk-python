import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

const FRONTEND = process.env.FRONTEND_URL;
if (!FRONTEND) throw new Error('FRONTEND_URL environment variable is required');

function emailLayout(opts: {
  preheader?: string;
  body: string;
  footerNote?: string;
}): string {
  const preheader = opts.preheader ?? "";
  const footerNote =
    opts.footerNote ?? "You received this email from Polyforge.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Polyforge</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    body{margin:0;padding:0;background:#f4f4f7;
         font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
    table{border-collapse:collapse}
    a{color:#06b6d4}
  </style>
</head>
<body>
  <span style="display:none;font-size:1px;color:#f4f4f7;max-height:0;max-width:0;opacity:0;overflow:hidden">
    ${preheader}
  </span>
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f7">
    <tr>
      <td align="center" style="padding:32px 16px 0">
        <table width="100%" border="0" cellspacing="0" cellpadding="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;
                      box-shadow:0 2px 16px rgba(0,0,0,0.06);overflow:hidden">
          <tr>
            <td bgcolor="#0a0a0f" align="center" style="padding:24px 32px">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="padding-right:10px;vertical-align:middle">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#67e8f9"/>
                        <stop offset="100%" stop-color="#06b6d4"/>
                      </linearGradient>
                    </defs>
                    <path d="M13 2L4.09 12.96H11L10 22L20.91 11.04H14L13 2Z" fill="url(#bg)"/>
                  </svg>
                </td>
                <td style="vertical-align:middle">
                  <span style="font-size:22px;font-weight:700;color:#f0f0f5;
                               font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                               letter-spacing:-0.5px">Polyforge</span>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 32px;color:#1f2937;
                       font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                       font-size:15px;line-height:1.7">
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td bgcolor="#f9fafb" style="padding:20px 40px;border-top:1px solid #e5e7eb;
                                         font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                                         font-size:12px;color:#9ca3af;line-height:1.6">
              <p style="margin:0 0 6px">${footerNote}</p>
              <p style="margin:0">
                <a href="${FRONTEND}/terms" style="color:#9ca3af;text-decoration:none">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${FRONTEND}/privacy" style="color:#9ca3af;text-decoration:none">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="font-size:12px;color:#9ca3af;margin:16px 0 32px;text-align:center">
          &copy; ${new Date().getFullYear()} Polyforge. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class AdminMailService {
  private readonly logger = new Logger(AdminMailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL;
    if (!fromEmail) throw new Error('AWS_SES_FROM_EMAIL environment variable is required');
    this.from = `Polyforge <${fromEmail}>`;
    const driver = process.env.EMAIL_DRIVER ?? "mailhog";

    if (driver === "mailhog") {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAILHOG_HOST ?? "localhost",
        port: parseInt(process.env.MAILHOG_PORT ?? "1025", 10),
        secure: false,
        ignoreTLS: true,
      } as any);
    } else {
      this.transporter = nodemailer.createTransport({
        host: `email-smtp.${process.env.AWS_SES_REGION ?? "us-east-1"}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_SMTP_USER,
          pass: process.env.AWS_SES_SMTP_PASSWORD,
        },
      });
    }
  }

  async sendInviteEmail(to: string, code: string): Promise<void> {
    const registerUrl = `${FRONTEND}/register?invite=${encodeURIComponent(code)}`;

    const html = emailLayout({
      preheader: `Your Polyforge invite code is ${code} — click to claim your spot.`,
      body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  Your invite is here
                </h2>
                <p style="margin:0 0 16px;color:#4b5563">
                  You're invited to join Polyforge — the algorithmic trading platform for
                  prediction markets. Use the code below to create your account.
                </p>

                <!-- Invite code block -->
                <div style="background:#0a0a0f;border-radius:10px;padding:20px 24px;
                            text-align:center;margin:0 0 24px">
                  <p style="margin:0 0 6px;font-size:12px;color:#9898b0;
                             font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                             text-transform:uppercase;letter-spacing:0.08em">Your invite code</p>
                  <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:4px;
                             color:#22d3ee;font-family:'Courier New',Courier,monospace">${code}</p>
                </div>

                <p style="text-align:center;margin:0 0 28px">
                  <a href="${registerUrl}"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    Claim your account
                  </a>
                </p>

                <p style="margin:0 0 12px;font-size:13px;color:#6b7280">
                  Or go to
                  <a href="${FRONTEND}/register" style="color:#06b6d4">${FRONTEND}/register</a>
                  and enter the code manually.
                </p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
                <p style="margin:0;font-size:13px;color:#9ca3af">
                  This invite code is single-use. Do not share it publicly.
                </p>
            `,
      footerNote:
        "You received this because you were on the Polyforge early-access waitlist.",
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Your Polyforge invite: ${code}`,
      text: `You're invited to join Polyforge!\n\nYour invite code: ${code}\n\nCreate your account at: ${registerUrl}\n\nThis code is single-use.`,
      html,
    });
    this.logger.log(`Invite email sent to ${to} with code ${code}`);
  }

  async sendAccountApprovedEmail(to: string, username: string): Promise<void> {
    const loginUrl = `${FRONTEND}/login`;

    const html = emailLayout({
      preheader: 'Your Polyforge beta access has been approved — you can now sign in!',
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
      footerNote: 'You received this because your Polyforge beta application was approved.',
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

  async sendTicketReminderEmail(
    to: string,
    username: string,
    ticketId: string,
    subject: string,
  ): Promise<void> {
    const ticketUrl = `${FRONTEND}/support/${ticketId}`;

    const html = emailLayout({
      preheader: `We're waiting for your reply on your support ticket.`,
      body: `
                <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">
                  We're waiting for your reply
                </h2>
                <p style="margin:0 0 16px;color:#4b5563">
                  Hi ${username}, our support team replied to your ticket but we
                  haven't heard back from you yet.
                </p>

                <div style="background:#f9fafb;border-radius:10px;padding:16px 20px;
                            border-left:4px solid #06b6d4;margin:0 0 24px">
                  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;
                             text-transform:uppercase;letter-spacing:0.06em">Ticket subject</p>
                  <p style="margin:0;font-size:16px;font-weight:600;color:#111827">${subject}</p>
                </div>

                <p style="text-align:center;margin:0 0 28px">
                  <a href="${ticketUrl}"
                     style="background:#06b6d4;border-radius:8px;color:#000;display:inline-block;
                            font-size:15px;font-weight:600;padding:12px 28px;text-decoration:none">
                    View your ticket
                  </a>
                </p>

                <p style="margin:0;font-size:13px;color:#9ca3af">
                  If you no longer need help, you can ignore this email and we'll
                  close the ticket automatically.
                </p>
            `,
      footerNote:
        "You received this because you have an open support ticket on Polyforge.",
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Reminder: Your support ticket "${subject}"`,
      text: `Hi ${username},\n\nOur support team replied to your ticket "${subject}" but we haven't heard back from you.\n\nView your ticket: ${ticketUrl}\n\nIf you no longer need help, you can ignore this email.`,
      html,
    });
    this.logger.log(
      `Ticket reminder email sent to ${to} for ticket ${ticketId}`,
    );
  }
}
