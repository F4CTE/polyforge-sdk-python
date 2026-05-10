import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

function makeNetworkError(): Error {
  const err = new Error("connect ECONNREFUSED");
  (err as any).code = "ECONNREFUSED";
  return err;
}

function makeSmtpTempError(code = 421): Error {
  const err = new Error(`SMTP temporary failure ${code}`);
  (err as any).responseCode = code;
  return err;
}

function makeSmtpPermError(code = 535): Error {
  const err = new Error(`SMTP authentication failed ${code}`);
  (err as any).responseCode = code;
  return err;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("MailService", () => {
  let service: MailService;

  beforeEach(() => {
    mockSendMail.mockClear();
    vi.spyOn(Math, "random").mockReturnValue(0);
    service = new MailService();
    // Skip actual sleep delays so retry tests run synchronously
    vi.spyOn(service as any, "sleep").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("retries on network error (ECONNREFUSED) and succeeds on second attempt", async () => {
    mockSendMail
      .mockRejectedValueOnce(makeNetworkError())
      .mockResolvedValueOnce({ messageId: "retry-id" });

    await service.send("user@example.com", "Subject", "text", "html");

    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("retries on Nodemailer socket error (ESOCKET) and succeeds on second attempt", async () => {
    const err = new Error("socket hang up");
    (err as any).code = "ESOCKET";
    mockSendMail
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ messageId: "retry-id" });

    await service.send("user@example.com", "Subject", "text", "html");

    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("retries on transient SMTP error (4xx) and succeeds on second attempt", async () => {
    mockSendMail
      .mockRejectedValueOnce(makeSmtpTempError(421))
      .mockResolvedValueOnce({ messageId: "retry-id" });

    await service.send("user@example.com", "Subject", "text", "html");

    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries on transient errors", async () => {
    mockSendMail.mockRejectedValue(makeNetworkError());

    await expect(
      service.send("user@example.com", "Subject", "text", "html"),
    ).rejects.toThrow("connect ECONNREFUSED");

    expect(mockSendMail).toHaveBeenCalledTimes(4);
  });

  it("does not retry on permanent SMTP error (5xx)", async () => {
    mockSendMail.mockRejectedValue(makeSmtpPermError(535));

    await expect(
      service.send("user@example.com", "Subject", "text", "html"),
    ).rejects.toThrow(/535/);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("does not retry on non-Error throws", async () => {
    mockSendMail.mockRejectedValue("plain string error");

    await expect(
      service.send("user@example.com", "Subject", "text", "html"),
    ).rejects.toBe("plain string error");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("applies jitter to the retry delay", async () => {
    // Mock Math.random to return 0.5 → jitter = base * 0.25 * 0.5 = base * 0.125
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    // Re-create service to pick up the new Math stub
    service = new MailService();
    const sleepSpy = vi
      .spyOn(service as any, "sleep")
      .mockResolvedValue(undefined);

    mockSendMail
      .mockRejectedValueOnce(makeNetworkError())
      .mockRejectedValueOnce(makeNetworkError())
      .mockRejectedValueOnce(makeNetworkError())
      .mockResolvedValueOnce({ messageId: "ok" });

    await service.send("user@example.com", "Subject", "text", "html");

    expect(mockSendMail).toHaveBeenCalledTimes(4);
    expect(sleepSpy).toHaveBeenCalledTimes(3);
    // attempt=1 → base=1000, jitter=125, delay=1125
    expect(sleepSpy.mock.calls[0][0]).toBe(1125);
    // attempt=2 → base=2000, jitter=250, delay=2250
    expect(sleepSpy.mock.calls[1][0]).toBe(2250);
    // attempt=3 → base=4000, jitter=500, delay=4500
    expect(sleepSpy.mock.calls[2][0]).toBe(4500);
  });
});
