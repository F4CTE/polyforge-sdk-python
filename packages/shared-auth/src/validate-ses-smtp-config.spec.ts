import { describe, expect, it } from "vitest";
import { validateSesSmtpConfig } from "./validate-ses-smtp-config";

describe("validateSesSmtpConfig", () => {
  it("does not require SES credentials for non-SES email drivers", () => {
    expect(() =>
      validateSesSmtpConfig("test-service", { EMAIL_DRIVER: "mailhog" }),
    ).not.toThrow();
  });

  it("requires SMTP credentials when SES is enabled", () => {
    expect(() =>
      validateSesSmtpConfig("test-service", {
        EMAIL_DRIVER: "ses",
        AWS_SES_REGION: "us-east-1",
        AWS_SES_FROM_EMAIL: "noreply@example.com",
      }),
    ).toThrow(
      "Missing required SES env vars when EMAIL_DRIVER=ses: AWS_SES_SMTP_USER, AWS_SES_SMTP_PASSWORD",
    );
  });

  it("accepts complete SES SMTP configuration", () => {
    expect(() =>
      validateSesSmtpConfig("test-service", {
        EMAIL_DRIVER: "ses",
        AWS_SES_REGION: "us-east-1",
        AWS_SES_FROM_EMAIL: "noreply@example.com",
        AWS_SES_SMTP_USER: "smtp-user",
        AWS_SES_SMTP_PASSWORD: "smtp-password",
      }),
    ).not.toThrow();
  });
});
