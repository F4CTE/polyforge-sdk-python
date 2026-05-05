import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nodemailer", () => ({
  createTransport: vi.fn().mockReturnValue({ sendMail: vi.fn() }),
}));

import * as nodemailer from "nodemailer";
import { AdminMailService } from "./mail.service";

describe("AdminMailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EMAIL_DRIVER", "ses");
    vi.stubEnv("AWS_SES_FROM_EMAIL", "noreply@polyforge.app");
    vi.stubEnv("AWS_SES_REGION", "eu-west-1");
    vi.stubEnv("AWS_SES_SMTP_USER", "smtp-user");
    vi.stubEnv("AWS_SES_SMTP_PASSWORD", "smtp-password");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires STARTTLS for the SES SMTP transport", () => {
    new AdminMailService();

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "email-smtp.eu-west-1.amazonaws.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: "smtp-user",
        pass: "smtp-password",
      },
    });
  });
});
