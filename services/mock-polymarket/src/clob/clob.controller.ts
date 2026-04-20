import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { ScenarioService } from "../scenario/scenario.service";
import { TOKENS_BY_ID, MARKETS_BY_ID } from "../fixtures/markets";
import { randomUUID } from "crypto";

interface MockOrder {
  id: string;
  clobOrderId: string;
  tokenId: string;
  side: "buy" | "sell";
  price: string;
  size: string;
  status: "PENDING" | "LIVE" | "MATCHED" | "CANCELLED" | "FAILED";
  filledSize: string;
  remainingSize: string;
  avgFillPrice: string | null;
  createdAt: string;
  updatedAt: string;
}

@Controller()
export class ClobController {
  private readonly orders = new Map<string, MockOrder>();

  constructor(private readonly scenario: ScenarioService) {}

  private async guard(reply: FastifyReply, ip: string): Promise<boolean> {
    if (this.scenario.shouldReturnDown()) {
      reply.status(503).send({ error: "Service Unavailable" });
      return false;
    }
    if (this.scenario.shouldRateLimit(ip)) {
      reply.status(429).send({ error: "Too Many Requests", retryAfter: 60 });
      return false;
    }
    await this.scenario.applyDelay();
    return true;
  }

  // GET /order-book/:tokenId
  @Get("order-book/:tokenId")
  async getOrderBook(
    @Param("tokenId") tokenId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!TOKENS_BY_ID.has(tokenId))
      return reply.status(404).send({ error: "Token not found" });

    const { bids, asks } = this.scenario.getOrderBook(tokenId);
    const midpoint = this.scenario.getPrice(tokenId);
    const spread = parseFloat(asks[0].price) - parseFloat(bids[0].price);

    const token = TOKENS_BY_ID.get(tokenId);
    reply.send({
      tokenId,
      bids,
      asks,
      spread: spread.toFixed(4),
      midpoint: midpoint.toFixed(4),
      timestamp: Date.now(),
      min_order_size: "5",
      tick_size: token ? "0.01" : "0.01",
      neg_risk: false,
    });
  }

  // POST /order — place an order
  @Post("order")
  async placeOrder(
    @Body()
    body: {
      tokenId: string;
      side: "buy" | "sell";
      price: string;
      size: string;
      orderType?: "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";
    },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const { tokenId, side, price, size, orderType = "GTC" } = body;

    if (!TOKENS_BY_ID.has(tokenId)) {
      return reply
        .status(400)
        .send({ error: "Invalid tokenId", code: "INVALID_TOKEN" });
    }
    if (!["buy", "sell"].includes(side)) {
      return reply
        .status(400)
        .send({ error: "Invalid side", code: "INVALID_SIDE" });
    }

    const orderId = randomUUID();
    const clobOrderId = `clob-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();

    const order: MockOrder = {
      id: orderId,
      clobOrderId,
      tokenId,
      side,
      price,
      size,
      status: "PENDING",
      filledSize: "0",
      remainingSize: size,
      avgFillPrice: null,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(orderId, order);

    // Simulate fill after delay
    this.simulateFill(orderId, parseFloat(price), parseFloat(size), orderType);

    reply.status(201).send({ orderId, clobOrderId, status: "PENDING" });
  }

  // DELETE /order/:orderId
  @Delete("order/:orderId")
  async cancelOrder(
    @Param("orderId") orderId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const order = this.orders.get(orderId);
    if (!order) return reply.status(404).send({ error: "Order not found" });

    if (["MATCHED", "CANCELLED", "FAILED"].includes(order.status)) {
      return reply.status(400).send({
        error: "Order cannot be cancelled",
        code: "ORDER_NOT_CANCELLABLE",
      });
    }

    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();

    reply.send({ orderId, status: "CANCELLED" });
  }

  // GET /order/:orderId
  @Get("order/:orderId")
  async getOrder(
    @Param("orderId") orderId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const order = this.orders.get(orderId);
    if (!order) return reply.status(404).send({ error: "Order not found" });

    reply.send(order);
  }

  // GET /orders — list all orders (for testing)
  @Get("orders")
  async listOrders(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("status") status?: string,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    let orders = [...this.orders.values()];
    if (status)
      orders = orders.filter((o) => o.status === status.toUpperCase());

    reply.send({ orders, total: orders.length });
  }

  // POST /orders/batch — place up to 15 orders at once
  @Post("orders/batch")
  async placeOrdersBatch(
    @Body()
    body: {
      orders: Array<{
        tokenId: string;
        side: "buy" | "sell";
        price: string;
        size: string;
      }>;
    },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    if (!Array.isArray(body.orders) || body.orders.length > 15) {
      return reply.status(400).send({ error: "Batch size must be 1-15" });
    }

    const results = body.orders.map((o) => {
      if (!TOKENS_BY_ID.has(o.tokenId))
        return { error: "Invalid tokenId", tokenId: o.tokenId };

      const orderId = randomUUID();
      const clobOrderId = `clob-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const now = new Date().toISOString();
      const order: MockOrder = {
        id: orderId,
        clobOrderId,
        tokenId: o.tokenId,
        side: o.side,
        price: o.price,
        size: o.size,
        status: "PENDING",
        filledSize: "0",
        remainingSize: o.size,
        avgFillPrice: null,
        createdAt: now,
        updatedAt: now,
      };
      this.orders.set(orderId, order);
      this.simulateFill(
        orderId,
        parseFloat(o.price),
        parseFloat(o.size),
        "GTC",
      );
      return { orderId, clobOrderId, status: "PENDING" };
    });

    reply.status(201).send({ results });
  }

  // GET /book?token_id=X — CLOB-style order book
  @Get("book")
  async getBook(
    @Query("token_id") tokenId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!tokenId || !TOKENS_BY_ID.has(tokenId))
      return reply.status(404).send({ error: "Token not found" });

    const { bids, asks } = this.scenario.getOrderBook(tokenId);
    const midpoint = this.scenario.getPrice(tokenId);
    const spread =
      parseFloat(asks[0].price) - parseFloat(bids[0].price);

    reply.send({
      bids,
      asks,
      spread: spread.toFixed(4),
      midpoint: midpoint.toFixed(4),
      timestamp: Date.now(),
    });
  }

  // POST /books — batch order books
  @Post("books")
  async getBooks(
    @Body() tokenIds: string[],
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!Array.isArray(tokenIds)) {
      return reply.status(400).send({ error: "Body must be an array of token IDs" });
    }

    const results = tokenIds.map((tokenId) => {
      if (!TOKENS_BY_ID.has(tokenId))
        return { tokenId, bids: [], asks: [], error: "Token not found" };

      const { bids, asks } = this.scenario.getOrderBook(tokenId);
      return { tokenId, bids, asks };
    });

    reply.send(results);
  }

  // GET /spread?token_id=X
  @Get("spread")
  async getSpread(
    @Query("token_id") tokenId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!tokenId || !TOKENS_BY_ID.has(tokenId))
      return reply.status(404).send({ error: "Token not found" });

    const { bids, asks } = this.scenario.getOrderBook(tokenId);
    const spread =
      parseFloat(asks[0].price) - parseFloat(bids[0].price);

    reply.send({ spread: spread.toFixed(4) });
  }

  // GET /midpoint?token_id=X
  @Get("midpoint")
  async getMidpoint(
    @Query("token_id") tokenId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!tokenId || !TOKENS_BY_ID.has(tokenId))
      return reply.status(404).send({ error: "Token not found" });

    const mid = this.scenario.getPrice(tokenId);
    reply.send({ mid: mid.toFixed(4) });
  }

  // GET /prices-history?token_id=X&interval=max&fidelity=60
  @Get("prices-history")
  async getPricesHistory(
    @Query("token_id") tokenId: string,
    @Query("fidelity") fidelity: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!tokenId || !TOKENS_BY_ID.has(tokenId))
      return reply.status(404).send({ error: "Token not found" });

    const count = parseInt(fidelity || "10", 10);
    const now = Date.now();
    const history = Array.from({ length: Math.min(count, 100) }, (_, i) => ({
      t: now - (count - i) * 60_000,
      p: this.scenario.getPrice(tokenId).toFixed(4),
    }));

    reply.send({ history });
  }

  // POST /batch-prices-history
  @Post("batch-prices-history")
  async getBatchPricesHistory(
    @Body() body: { tokenIds: string[]; fidelity?: number },
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;
    if (!Array.isArray(body.tokenIds)) {
      return reply.status(400).send({ error: "tokenIds must be an array" });
    }

    const count = body.fidelity ?? 10;
    const now = Date.now();
    const result: Record<string, Array<{ t: number; p: string }>> = {};

    for (const tokenId of body.tokenIds) {
      if (!TOKENS_BY_ID.has(tokenId)) continue;
      result[tokenId] = Array.from({ length: Math.min(count, 100) }, (_, i) => ({
        t: now - (count - i) * 60_000,
        p: this.scenario.getPrice(tokenId).toFixed(4),
      }));
    }

    reply.send(result);
  }

  // POST /orders — batch place up to 15
  @Post("orders")
  async placeBatchOrders(
    @Body()
    body: Array<{
      tokenId: string;
      side: "buy" | "sell";
      price: string;
      size: string;
    }>,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    if (!Array.isArray(body) || body.length > 15) {
      return reply.status(400).send({ error: "Batch size must be 1-15" });
    }

    const results = body.map((o) => {
      if (!TOKENS_BY_ID.has(o.tokenId))
        return { error: "Invalid tokenId", tokenId: o.tokenId };

      const orderId = randomUUID();
      return { orderID: orderId, status: "PENDING" };
    });

    reply.status(201).send(results);
  }

  // DELETE /orders — bulk cancel up to 3000
  @Delete("orders")
  async cancelBulkOrders(
    @Body() orderIds: string[],
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    if (!Array.isArray(orderIds) || orderIds.length > 3000) {
      return reply.status(400).send({ error: "Cancel limit is 3000" });
    }

    const cancelled = orderIds.filter((id) => {
      const order = this.orders.get(id);
      if (order && ["PENDING", "LIVE"].includes(order.status)) {
        order.status = "CANCELLED";
        return true;
      }
      return false;
    });

    reply.send({ cancelled });
  }

  // ─── Simulation ───────────────────────────────────────────────────────────

  private simulateFill(
    orderId: string,
    requestedPrice: number,
    size: number,
    orderType: string,
  ) {
    const fillDelay = this.scenario.fillDelayMs();

    setTimeout(() => {
      const order = this.orders.get(orderId);
      if (!order || order.status !== "PENDING") return;

      const currentPrice = this.scenario.getPrice(order.tokenId);
      const priceMatch = Math.abs(currentPrice - requestedPrice) < 0.05;
      const slippage = (Math.random() - 0.5) * 0.01;
      const fillPrice = Math.max(0.01, Math.min(0.99, currentPrice + slippage));

      if (orderType === "POST_ONLY") {
        // Rejected if would immediately match
        if (priceMatch) {
          order.status = "CANCELLED";
          order.updatedAt = new Date().toISOString();
          return;
        }
      } else if (orderType === "FOK") {
        // Cancelled if not immediately fillable
        if (!priceMatch) {
          order.status = "CANCELLED";
          order.updatedAt = new Date().toISOString();
          return;
        }
      } else if (orderType === "FAK") {
        // Partial fill: 50-100% of size, cancel remainder
        const fillFraction = 0.5 + Math.random() * 0.5;
        const filled = (size * fillFraction).toFixed(4);
        const remaining = (size * (1 - fillFraction)).toFixed(4);
        order.status = "MATCHED";
        order.filledSize = filled;
        order.remainingSize = remaining;
        order.avgFillPrice = fillPrice.toFixed(4);
        order.updatedAt = new Date().toISOString();
        return;
      }

      // GTC / GTD — full fill
      order.status = "MATCHED";
      order.filledSize = size.toString();
      order.remainingSize = "0";
      order.avgFillPrice = fillPrice.toFixed(4);
      order.updatedAt = new Date().toISOString();
    }, fillDelay);
  }
}
