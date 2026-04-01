import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL;
    if (!fromEmail) throw new Error('AWS_SES_FROM_EMAIL environment variable is required');
    this.from = `Polyforge <${fromEmail}>`;
    const driver = process.env.EMAIL_DRIVER ?? "mailhog";

    if (driver === "mailhog") {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAILHOG_HOST ?? "mailhog",
        port: parseInt(process.env.MAILHOG_PORT ?? "1025", 10),
        secure: false,
        ignoreTLS: true,
      } as any);
    } else {
      // SES via SMTP (production)
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

  async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
    this.logger.log(`Email sent to ${to}: "${subject}"`);
  }
}
