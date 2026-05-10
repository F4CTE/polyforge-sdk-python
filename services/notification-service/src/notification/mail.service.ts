import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

// 4 attempts = initial send + up to 3 retries (1s / 2s / 4s backoff stages)
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_000;
const MAX_DELAY_MS = 30_000;

function isTransientSmtpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Node.js network/system error codes — safe to retry
  const nodeErr = err as NodeJS.ErrnoException;
  if (nodeErr.code) {
    const transientCodes = new Set([
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EAI_AGAIN",
      "EPIPE",
      "ECONNABORTED",
      "ECONNECTION", // Nodemailer-level connection failure
      "EDNS", // DNS resolution failure
      "ESOCKET", // socket-level error (transient network)
    ]);
    if (transientCodes.has(nodeErr.code)) return true;
  }

  // SMTP response codes:
  // 4xx = temporary failure → retry
  // 5xx = permanent failure → don't retry
  const smtpErr = err as { responseCode?: number };
  if (typeof smtpErr.responseCode === "number") {
    return smtpErr.responseCode >= 400 && smtpErr.responseCode < 500;
  }

  return false;
}

function computeDelay(attempt: number): number {
  const base = RETRY_BASE_MS * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * base * 0.25);
  return Math.min(base + jitter, MAX_DELAY_MS);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    this.from = `Polyforge <${process.env.AWS_SES_FROM_EMAIL ?? "noreply@polyforge.app"}>`;
    const driver = process.env.EMAIL_DRIVER ?? "mailhog";

    if (driver === "mailhog") {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAILHOG_HOST ?? "mailhog",
        port: parseInt(process.env.MAILHOG_PORT ?? "1025", 10),
        secure: false,
        ignoreTLS: true,
      } as any);
    } else {
      // SES via SMTP (production) — port 587 uses STARTTLS; requireTLS enforces upgrade
      this.transporter = nodemailer.createTransport({
        host: `email-smtp.${process.env.AWS_SES_REGION ?? "us-east-1"}.amazonaws.com`,
        port: 587,
        secure: false,
        requireTLS: true,
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
    let lastError: unknown;

    // NOTE: Retrying on network errors carries a small risk of duplicate
    // delivery if the SMTP server accepted the message but the response was
    // lost. SMTP does not provide request-level idempotency, so this
    // tradeoff favours reliability over strict at-most-once semantics.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`Email sent to ${to}: "${subject}"`);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS && isTransientSmtpError(err)) {
          const delay = computeDelay(attempt);
          this.logger.warn(
            `Email send attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${delay}ms`,
          );
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
