import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock nodemailer before importing MailService ───────────────────────────

vi.mock("nodemailer", () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
  return {
    default: { createTransport: vi.fn().mockReturnValue({ sendMail }) },
    createTransport: vi.fn().mockReturnValue({ sendMail }),
    __mockSendMail: sendMail,
  };
});

import { MailService } from "./mail.service";
import * as nodemailer from "nodemailer";
const mockSendMail = (nodemailer as any).__mockSendMail;

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("MailService", () => {
  let service: MailService;

  beforeEach(() => {
    mockSendMail.mockClear();
    service = new MailService();
  });

  it("sends an email with the correct parameters", async () => {
    await service.send(
      "user@example.com",
      "Test Subject",
      "Plain text",
      "<h1>HTML</h1>",
    );

    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Test Subject",
        text: "Plain text",
        html: "<h1>HTML</h1>",
      }),
    );
  });

  it("includes a from address in the email", async () => {
    await service.send("user@example.com", "Subject", "text", "html");

    const call = mockSendMail.mock.calls[0][0];
    expect(call.from).toBeDefined();
    expect(typeof call.from).toBe("string");
  });

  it("throws when sendMail fails", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP connection refused"));

    await expect(
      service.send("user@example.com", "Subject", "text", "html"),
    ).rejects.toThrow("SMTP connection refused");
  });
});
