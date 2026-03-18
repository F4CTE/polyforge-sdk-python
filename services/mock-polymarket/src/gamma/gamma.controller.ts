import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { ScenarioService } from "../scenario/scenario.service";
import {
  FIXTURE_MARKETS,
  MARKETS_BY_ID,
  MARKETS_BY_SLUG,
} from "../fixtures/markets";

@Controller()
export class GammaController {
  constructor(private readonly scenario: ScenarioService) {}

  private async guard(reply: FastifyReply, ip: string): Promise<boolean> {
    if (this.scenario.shouldReturnDown()) {
      reply
        .status(503)
        .send({ error: "Service Unavailable", code: "SERVICE_DOWN" });
      return false;
    }
    if (this.scenario.shouldRateLimit(ip)) {
      reply.status(429).send({ error: "Too Many Requests", retryAfter: 60 });
      return false;
    }
    await this.scenario.applyDelay();
    return true;
  }

  // GET /markets
  @Get("markets")
  async listMarkets(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("category") category?: string,
    @Query("closed") closed?: string,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    let markets = [...FIXTURE_MARKETS];
    if (category)
      markets = markets.filter(
        (m) => m.category.toLowerCase() === category.toLowerCase(),
      );
    if (closed !== undefined)
      markets = markets.filter((m) => m.closed === (closed === "true"));

    const off = parseInt(offset ?? "0", 10);
    const lim = Math.min(parseInt(limit ?? "20", 10), 100);
    const page = markets.slice(off, off + lim);

    reply.send({
      data: page.map(this.formatMarket.bind(this)),
      pagination: { limit: lim, offset: off, total: markets.length },
    });
  }

  // GET /markets/:marketId
  @Get("markets/:marketId")
  async getMarket(
    @Param("marketId") marketId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!(await this.guard(reply, req.ip))) return;

    const market = MARKETS_BY_ID.get(marketId) ?? MARKETS_BY_SLUG.get(marketId);
    if (!market) {
      return reply.status(404).send({ error: "Market not found" });
    }

    reply.send(this.formatMarket(market));
  }

  // GET /events (series markets)
  @Get("events")
  async listEvents(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    if (!(await this.guard(reply, req.ip))) return;

    const series = FIXTURE_MARKETS.filter((m) => m.seriesSlug).reduce(
      (acc, m) => {
        const slug = m.seriesSlug!;
        if (!acc.has(slug)) acc.set(slug, { slug, markets: [] });
        acc.get(slug)!.markets.push(this.formatMarket(m));
        return acc;
      },
      new Map<string, { slug: string; markets: any[] }>(),
    );

    reply.send({ data: [...series.values()] });
  }

  private formatMarket(m: import("../fixtures/markets").MockMarket) {
    const yesToken = m.tokens[0];
    const noToken = m.tokens[1];
    const yesLive = this.scenario.getPrice(yesToken.tokenId);
    const noLive = this.scenario.getPrice(noToken.tokenId);

    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      category: m.category,
      seriesSlug: m.seriesSlug ?? null,
      tokens: [
        { ...yesToken, price: yesLive.toFixed(2) },
        { ...noToken, price: noLive.toFixed(2) },
      ],
      volume24h: m.volume24h,
      liquidityTotal: m.liquidityTotal,
      endDate: m.endDate,
      closed: m.closed,
      active: m.active,
    };
  }
}
