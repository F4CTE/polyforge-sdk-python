import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@polyforge/shared-db";
import { RedisService } from "@polyforge/shared-redis";
import { randomUUID } from "crypto";

const ENGINE_URL =
  process.env.STRATEGY_ENGINE_URL ?? "http://strategy-engine:3006";
const API_URL = process.env.API_SERVICE_URL ?? "http://api-service:3002";

const HELP_TEXT = `
📖 Polyforge Bot Commands

📊 Strategy
/status        — All running strategies + live P&L
/stop <name>   — Stop a strategy
/pause <name>  — Pause a strategy
/resume <name> — Resume a paused strategy

📈 Portfolio
/pnl           — Today's P&L (all strategies)
/pnl <name>    — P&L for a specific strategy
/orders        — Last 5 orders
/positions     — Open positions
/paper         — Paper trading summary
/alerts        — Your active price alerts

🐋 Whales
/whales              — Top 5 whale trades in last 24h
/whale <address>     — Whale profile (volume, P&L, trades)

📋 Copy Trading
/copies              — List active copy configs
/copy <wallet>       — Quick-start copy config for a wallet
/stopcopy <id>       — Stop a copy config

📡 Signals & News
/signals             — Top 5 high-confidence AI signals
/news                — Latest 3 news articles with signals

🎯 Advanced Orders
/tp <market> <price> — Set take-profit on current position
/sl <market> <price> — Set stop-loss on current position

🔗 Account
/connect <code> — Link your Polyforge account
/disconnect     — Unlink this bot account
/help           — Show this message
`.trim();

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Router ───────────────────────────────────────────────────────────────

  async execute(userId: string, text: string): Promise<string> {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(" ").trim();

    switch (cmd.toLowerCase()) {
      case "/status":
        return this.status(userId);
      case "/stop":
        return this.controlStrategy(userId, arg, "stop");
      case "/pause":
        return this.controlStrategy(userId, arg, "pause");
      case "/resume":
        return this.controlStrategy(userId, arg, "resume");
      case "/pnl":
        return this.pnl(userId, arg || null);
      case "/orders":
        return this.orders(userId);
      case "/positions":
        return this.positions(userId);
      case "/paper":
        return this.paper(userId);
      case "/alerts":
        return this.alerts(userId);
      // Phase 8 — Whale commands
      case "/whales":
        return this.whales(userId);
      case "/whale":
        return this.whaleProfile(userId, arg);
      // Phase 8 — Copy trading commands
      case "/copies":
        return this.copies(userId);
      case "/copy":
        return this.copyStart(userId, arg);
      case "/stopcopy":
        return this.stopCopy(userId, arg);
      // Phase 8 — Signals & News
      case "/signals":
        return this.signals(userId);
      case "/news":
        return this.news(userId);
      // Phase 8 — Advanced orders
      case "/tp":
        return this.takeProfit(userId, arg);
      case "/sl":
        return this.stopLoss(userId, arg);
      case "/help":
        return HELP_TEXT;
      default:
        return `Unknown command: ${cmd}\n\nType /help for a list of commands.`;
    }
  }

  // ─── /status ──────────────────────────────────────────────────────────────

  private async status(userId: string): Promise<string> {
    const strategies = await this.prisma.strategy.findMany({
      where: {
        userId,
        status: { in: ["RUNNING", "PAUSED", "PAPER"] as any[] },
      },
      select: { name: true, status: true },
    });

    if (strategies.length === 0) {
      return "📊 No active strategies. Start one in the Polyforge app.";
    }

    const paperPnl = await this.redis.get(`paper:${userId}:pnl`);
    const lines = strategies.map((s) => `• ${s.name} [${s.status}]`);
    if (paperPnl)
      lines.push(`\n📄 Paper P&L: ${parseFloat(paperPnl).toFixed(2)} USDC`);

    return `📊 Active strategies:\n\n${lines.join("\n")}`;
  }

  // ─── /stop, /pause, /resume ────────────────────────────────────────────────

  private async controlStrategy(
    userId: string,
    name: string,
    action: "stop" | "pause" | "resume",
  ): Promise<string> {
    if (!name) return `Usage: /${action} <strategy name>`;

    const strategy = await this.prisma.strategy.findFirst({
      where: {
        userId,
        name: { contains: name, mode: "insensitive" },
        status: { not: "ARCHIVED" as any },
      },
      select: { id: true, name: true, status: true },
    });

    if (!strategy) {
      return `❌ Strategy "${name}" not found.`;
    }

    try {
      const token = this.issueInternalToken();
      let url: string;
      let method: string;

      if (action === "stop") {
        url = `${ENGINE_URL}/internal/strategies/${strategy.id}`;
        method = "DELETE";
      } else {
        url = `${ENGINE_URL}/internal/strategies/${strategy.id}/${action}`;
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        this.logger.warn(
          `Engine ${action} returned ${res.status} for strategy ${strategy.id}`,
        );
        return `⚠️ Strategy "${strategy.name}" could not be ${action}ped (engine error ${res.status}).`;
      }
    } catch (err: any) {
      this.logger.error(`Engine ${action} failed: ${err?.message}`);
      return `⚠️ Could not reach strategy engine. Try again shortly.`;
    }

    const verb =
      action === "stop" ? "stopped" : action === "pause" ? "paused" : "resumed";
    return `✅ Strategy "${strategy.name}" ${verb}.`;
  }

  // ─── /pnl ─────────────────────────────────────────────────────────────────

  private async pnl(
    userId: string,
    strategyName: string | null,
  ): Promise<string> {
    // Real realized P&L: sum from positions
    const agg = await this.prisma.position.aggregate({
      where: { userId },
      _sum: { realizedPnl: true },
    });
    const realizedPnl = Number(agg._sum.realizedPnl ?? 0);

    // Paper P&L from Redis
    const paperRaw = await this.redis.get(`paper:${userId}:pnl`);
    const paperPnl = parseFloat(paperRaw ?? "0");

    if (strategyName) {
      const strategy = await this.prisma.strategy.findFirst({
        where: {
          userId,
          name: { contains: strategyName, mode: "insensitive" },
          status: { not: "ARCHIVED" as any },
        },
        select: { id: true, name: true },
      });
      if (!strategy) return `❌ Strategy "${strategyName}" not found.`;

      return [
        `📈 P&L for "${strategy.name}"`,
        `(Strategy-level P&L is aggregated across all positions)`,
        `Total realized: ${realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)} USDC`,
      ].join("\n");
    }

    return [
      "📈 Overall P&L",
      `Realized: ${realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)} USDC`,
      `Paper:    ${paperPnl >= 0 ? "+" : ""}${paperPnl.toFixed(2)} USDC`,
    ].join("\n");
  }

  // ─── /orders ──────────────────────────────────────────────────────────────

  private async orders(userId: string): Promise<string> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        tokenId: true,
        side: true,
        size: true,
        fillPrice: true,
        status: true,
        createdAt: true,
      },
    });

    if (orders.length === 0) return "📋 No orders found.";

    const lines = orders.map(
      (o) =>
        `• ${o.side} ${Number(o.size).toFixed(2)} @ ${Number(o.fillPrice ?? 0).toFixed(3)} [${o.status}]`,
    );
    return `📋 Last ${orders.length} order${orders.length > 1 ? "s" : ""}:\n\n${lines.join("\n")}`;
  }

  // ─── /positions ───────────────────────────────────────────────────────────

  private async positions(userId: string): Promise<string> {
    const positions = await this.prisma.position.findMany({
      where: { userId, resolutionStatus: "UNRESOLVED" as any },
      select: {
        tokenId: true,
        outcome: true,
        size: true,
        avgPrice: true,
        unrealizedPnl: true,
      },
    });

    if (positions.length === 0) return "📦 No open positions.";

    const lines = positions.map(
      (p) =>
        `• ${p.tokenId.slice(0, 12)}… ${p.outcome} · ${Number(p.size).toFixed(2)} @ ${Number(p.avgPrice).toFixed(3)} · uPnL: ${Number(p.unrealizedPnl) >= 0 ? "+" : ""}${Number(p.unrealizedPnl).toFixed(2)}`,
    );
    return `📦 Open positions (${positions.length}):\n\n${lines.join("\n")}`;
  }

  // ─── /paper ───────────────────────────────────────────────────────────────

  private async paper(userId: string): Promise<string> {
    const [pnlRaw, posCount, orderCount] = await Promise.all([
      this.redis.get(`paper:${userId}:pnl`),
      this.prisma.paperPosition.count({ where: { userId } }),
      this.prisma.paperOrder.count({
        where: { userId, status: "CONFIRMED" as any },
      }),
    ]);

    const pnl = parseFloat(pnlRaw ?? "0");
    return [
      "📄 Paper trading summary",
      `P&L:     ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDC`,
      `Orders:  ${orderCount}`,
      `Positions: ${posCount}`,
    ].join("\n");
  }

  // ─── /alerts ──────────────────────────────────────────────────────────────

  private async alerts(userId: string): Promise<string> {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { userId, triggered: false },
      select: { tokenId: true, direction: true, price: true },
      take: 10,
    });

    if (alerts.length === 0) return "🔔 No active price alerts.";

    const lines = alerts.map(
      (a) =>
        `• ${a.tokenId.slice(0, 12)}… ${a.direction} ${Number(a.price).toFixed(3)}`,
    );
    return `🔔 Active alerts (${alerts.length}):\n\n${lines.join("\n")}`;
  }

  // ─── /whales ──────────────────────────────────────────────────────────────

  private async whales(_userId: string): Promise<string> {
    try {
      const token = this.issueInternalToken();
      const res = await fetch(`${API_URL}/internal/whales/top?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return "⚠️ Could not fetch whale data. Try again shortly.";
      }

      const data: any = await res.json();
      const trades: any[] = data.trades ?? data ?? [];

      if (trades.length === 0) {
        return "🐋 No whale trades in the last 24h.";
      }

      const lines = trades.slice(0, 5).map((t: any, i: number) => {
        const addr = String(t.wallet ?? t.address ?? "unknown").slice(0, 8);
        const side = t.side ?? "BUY";
        const size = Number(t.sizeUsdc ?? t.size ?? 0).toFixed(0);
        const market = String(t.market ?? t.tokenId ?? "").slice(0, 20);
        return `${i + 1}. ${addr}… ${side} $${size} on ${market}`;
      });

      return `🐋 Top whale trades (24h):\n\n${lines.join("\n")}`;
    } catch (err: any) {
      this.logger.error(`/whales failed: ${err?.message}`);
      return "⚠️ Could not fetch whale data. Try again shortly.";
    }
  }

  // ─── /whale <address> ─────────────────────────────────────────────────────

  private async whaleProfile(
    _userId: string,
    address: string,
  ): Promise<string> {
    if (!address) return "Usage: /whale <wallet address>";

    try {
      const token = this.issueInternalToken();
      const res = await fetch(
        `${API_URL}/internal/whales/${encodeURIComponent(address)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        if (res.status === 404)
          return `🐋 Whale "${address.slice(0, 10)}…" not found.`;
        return "⚠️ Could not fetch whale profile. Try again shortly.";
      }

      const w: any = await res.json();
      const vol = Number(w.totalVolume ?? 0).toFixed(0);
      const pnl = Number(w.totalPnl ?? 0);
      const pnlStr = `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`;
      const trades = Number(w.tradeCount ?? 0);

      return [
        `🐋 Whale: ${String(w.address ?? address).slice(0, 10)}…`,
        `Volume:  $${vol}`,
        `P&L:     ${pnlStr} USDC`,
        `Trades:  ${trades}`,
      ].join("\n");
    } catch (err: any) {
      this.logger.error(`/whale failed: ${err?.message}`);
      return "⚠️ Could not fetch whale profile. Try again shortly.";
    }
  }

  // ─── /copies ──────────────────────────────────────────────────────────────

  private async copies(userId: string): Promise<string> {
    try {
      const token = this.issueInternalToken();
      const res = await fetch(
        `${API_URL}/internal/copy-configs?userId=${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        return "⚠️ Could not fetch copy configs. Try again shortly.";
      }

      const data: any = await res.json();
      const configs: any[] = data.configs ?? data ?? [];

      if (configs.length === 0) {
        return "📋 No active copy configs. Use /copy <wallet> to start one.";
      }

      const lines = configs.map((c: any) => {
        const wallet = String(c.targetWallet ?? c.wallet ?? "").slice(0, 10);
        const status = c.status ?? "ACTIVE";
        const mode = c.mode ?? "PERCENTAGE";
        const pct = c.percentage != null ? `${c.percentage}%` : "";
        return `• ${wallet}… [${status}] ${mode} ${pct}`;
      });

      return `📋 Copy configs (${configs.length}):\n\n${lines.join("\n")}`;
    } catch (err: any) {
      this.logger.error(`/copies failed: ${err?.message}`);
      return "⚠️ Could not fetch copy configs. Try again shortly.";
    }
  }

  // ─── /copy <wallet> ───────────────────────────────────────────────────────

  private async copyStart(userId: string, wallet: string): Promise<string> {
    if (!wallet) return "Usage: /copy <wallet address>";

    try {
      const token = this.issueInternalToken();
      const res = await fetch(`${API_URL}/internal/copy-configs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          targetWallet: wallet,
          mode: "PERCENTAGE",
          percentage: 10,
          maxExposureUsdc: 500,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`/copy create failed ${res.status}: ${body}`);
        return "⚠️ Could not create copy config. Try again shortly.";
      }

      const data: any = await res.json();
      return [
        "✅ Copy config created!",
        `Target: ${wallet.slice(0, 10)}…`,
        `Mode:   PERCENTAGE (10%)`,
        `Max:    $500 exposure`,
        data.id ? `ID:     ${data.id}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (err: any) {
      this.logger.error(`/copy failed: ${err?.message}`);
      return "⚠️ Could not create copy config. Try again shortly.";
    }
  }

  // ─── /stopcopy <id> ───────────────────────────────────────────────────────

  private async stopCopy(userId: string, configId: string): Promise<string> {
    if (!configId) return "Usage: /stopcopy <config id>";

    try {
      const token = this.issueInternalToken();
      const res = await fetch(
        `${API_URL}/internal/copy-configs/${encodeURIComponent(configId)}/stop`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        },
      );

      if (!res.ok) {
        if (res.status === 404)
          return `❌ Copy config "${configId}" not found.`;
        return "⚠️ Could not stop copy config. Try again shortly.";
      }

      return `✅ Copy config "${configId}" stopped.`;
    } catch (err: any) {
      this.logger.error(`/stopcopy failed: ${err?.message}`);
      return "⚠️ Could not stop copy config. Try again shortly.";
    }
  }

  // ─── /signals ─────────────────────────────────────────────────────────────

  private async signals(_userId: string): Promise<string> {
    try {
      const token = this.issueInternalToken();
      const res = await fetch(
        `${API_URL}/internal/signals?limit=5&minConfidence=0.7`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        return "⚠️ Could not fetch signals. Try again shortly.";
      }

      const data: any = await res.json();
      const signals: any[] = data.signals ?? data ?? [];

      if (signals.length === 0) {
        return "📡 No high-confidence signals right now.";
      }

      const lines = signals.slice(0, 5).map((s: any, i: number) => {
        const market = String(s.market ?? s.title ?? "").slice(0, 30);
        const direction = s.direction ?? s.signal ?? "—";
        const conf = (Number(s.confidence ?? 0) * 100).toFixed(0);
        return `${i + 1}. ${market}\n   ${direction} (${conf}% confidence)`;
      });

      return `📡 Top AI signals:\n\n${lines.join("\n\n")}`;
    } catch (err: any) {
      this.logger.error(`/signals failed: ${err?.message}`);
      return "⚠️ Could not fetch signals. Try again shortly.";
    }
  }

  // ─── /news ────────────────────────────────────────────────────────────────

  private async news(_userId: string): Promise<string> {
    try {
      const token = this.issueInternalToken();
      const res = await fetch(`${API_URL}/internal/news?limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return "⚠️ Could not fetch news. Try again shortly.";
      }

      const data: any = await res.json();
      const articles: any[] = data.articles ?? data ?? [];

      if (articles.length === 0) {
        return "📰 No recent news articles.";
      }

      const lines = articles.slice(0, 3).map((a: any, i: number) => {
        const title = String(a.title ?? "Untitled").slice(0, 50);
        const signalCount = Number(a.signalCount ?? a.signals?.length ?? 0);
        const source = a.source ?? "";
        return `${i + 1}. ${title}\n   ${source ? source + " · " : ""}${signalCount} signal${signalCount !== 1 ? "s" : ""}`;
      });

      return `📰 Latest news:\n\n${lines.join("\n\n")}`;
    } catch (err: any) {
      this.logger.error(`/news failed: ${err?.message}`);
      return "⚠️ Could not fetch news. Try again shortly.";
    }
  }

  // ─── /tp <market> <price> ─────────────────────────────────────────────────

  private async takeProfit(userId: string, arg: string): Promise<string> {
    return this.setConditionalOrder(userId, arg, "TAKE_PROFIT");
  }

  // ─── /sl <market> <price> ─────────────────────────────────────────────────

  private async stopLoss(userId: string, arg: string): Promise<string> {
    return this.setConditionalOrder(userId, arg, "STOP_LOSS");
  }

  private async setConditionalOrder(
    userId: string,
    arg: string,
    type: "TAKE_PROFIT" | "STOP_LOSS",
  ): Promise<string> {
    const cmd = type === "TAKE_PROFIT" ? "/tp" : "/sl";
    const label = type === "TAKE_PROFIT" ? "Take-profit" : "Stop-loss";

    const parts = arg.split(/\s+/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return `Usage: ${cmd} <market> <price>`;
    }

    const market = parts[0];
    const price = parseFloat(parts[1]);
    if (isNaN(price) || price <= 0) {
      return `❌ Invalid price "${parts[1]}". Must be a positive number.`;
    }

    try {
      const token = this.issueInternalToken();
      const res = await fetch(`${API_URL}/internal/conditional-orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          market,
          triggerPrice: price,
          type,
        }),
      });

      if (!res.ok) {
        if (res.status === 404) {
          return `❌ No open position found for "${market}".`;
        }
        return `⚠️ Could not set ${label.toLowerCase()}. Try again shortly.`;
      }

      const data: any = await res.json();
      return [
        `✅ ${label} set!`,
        `Market:  ${market}`,
        `Trigger: $${price.toFixed(3)}`,
        data.id ? `ID:      ${data.id}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (err: any) {
      this.logger.error(`${cmd} failed: ${err?.message}`);
      return `⚠️ Could not set ${label.toLowerCase()}. Try again shortly.`;
    }
  }

  // ─── Internal JWT ─────────────────────────────────────────────────────────

  private issueInternalToken(): string {
    return this.jwt.sign(
      { sub: "bot-service", jti: randomUUID() },
      {
        secret: this.config.getOrThrow<string>("INTERNAL_JWT_SECRET"),
        audience: "strategy-engine",
        expiresIn: "30s",
      },
    );
  }
}
