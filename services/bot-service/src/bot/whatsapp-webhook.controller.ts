import { Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { WhatsAppService } from "./whatsapp.service";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Webhook controller for WhatsApp Business Cloud API.
 *
 * GET  /webhook/whatsapp  — Meta verification challenge
 * POST /webhook/whatsapp  — Incoming message webhook
 */
@Controller("webhook/whatsapp")
export class WhatsAppWebhookController {
  constructor(private readonly whatsapp: WhatsAppService) {}

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
    // Always respond 200 immediately to Meta (they retry on non-200)
    reply.status(200).send("EVENT_RECEIVED");

    // Process asynchronously
    await this.whatsapp.handleIncoming(request.body);
  }
}
