import { Controller, Get, Post, Query, Req, Res, Logger } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import type { FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";

/**
 * Webhook controller for WhatsApp Business Cloud API.
 *
 * GET  /webhook/whatsapp  — Meta verification challenge
 * POST /webhook/whatsapp  — Incoming message webhook
 *
 * SECURITY: POST endpoint validates X-Hub-Signature-256 header
 * using HMAC-SHA256 with the WHATSAPP_APP_SECRET to prevent
 * spoofed webhook payloads (Meta standard security practice).
 */
@Controller("webhook/whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly appSecret: string;

  constructor(private readonly whatsapp: WhatsAppService) {
    this.appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  }

  @Get()
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
    @Res() reply: FastifyReply,
  ) {
    const result = this.whatsapp.handleVerification({
      "hub.mode": mode,
      "hub.verify_token": token,
      "hub.challenge": challenge,
    });
    return reply.status(result.status).send(result.body);
  }

  @Post()
  async incoming(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    // SECURITY: Validate X-Hub-Signature-256 from Meta
    if (!this.appSecret) {
      // Reject webhooks when secret is not configured in production
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "WHATSAPP_APP_SECRET is not configured — rejecting webhook",
        );
        return reply.status(500).send("Webhook not configured");
      }
    } else {
      const signature = request.headers["x-hub-signature-256"] as string;
      if (!signature) {
        this.logger.warn("WhatsApp webhook missing X-Hub-Signature-256 header");
        return reply.status(401).send("Missing signature");
      }

      const rawBody =
        typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body);
      const expectedSignature =
        "sha256=" +
        crypto
          .createHmac("sha256", this.appSecret)
          .update(rawBody)
          .digest("hex");

      // SECURITY: Check buffer lengths before timingSafeEqual to avoid RangeError
      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSignature);
      if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
      ) {
        this.logger.warn("WhatsApp webhook signature mismatch — rejecting");
        return reply.status(403).send("Invalid signature");
      }
    }

    // Always respond 200 immediately to Meta (they retry on non-200)
    reply.status(200).send("EVENT_RECEIVED");

    // Process asynchronously
    await this.whatsapp.handleIncoming(request.body);
  }
}
