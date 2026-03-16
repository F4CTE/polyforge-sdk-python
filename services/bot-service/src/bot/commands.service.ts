import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@polyforge/shared-db';
import { RedisService } from '@polyforge/shared-redis';
import { randomUUID } from 'crypto';

const ENGINE_URL      = process.env.STRATEGY_ENGINE_URL ?? 'http://strategy-engine:3006';
const INTERNAL_SECRET = process.env.INTERNAL_JWT_SECRET ?? 'dev-internal-jwt-secret';

const HELP_TEXT = `
📖 Polyforge Bot Commands

/status        — All running strategies + live P&L
/stop <name>   — Stop a strategy
/pause <name>  — Pause a strategy
/resume <name> — Resume a paused strategy
/pnl           — Today's P&L (all strategies)
/pnl <name>    — P&L for a specific strategy
/orders        — Last 5 orders
/positions     — Open positions
/paper         — Paper trading summary
/alerts        — Your active price alerts
/disconnect    — Unlink this bot account
/help          — Show this message
`.trim();

@Injectable()
export class CommandsService {
    private readonly logger = new Logger(CommandsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
        private readonly jwt: JwtService,
    ) {}

    // ─── Router ───────────────────────────────────────────────────────────────

    async execute(userId: string, text: string): Promise<string> {
        const [cmd, ...rest] = text.trim().split(/\s+/);
        const arg = rest.join(' ').trim();

        switch (cmd.toLowerCase()) {
            case '/status':   return this.status(userId);
            case '/stop':     return this.controlStrategy(userId, arg, 'stop');
            case '/pause':    return this.controlStrategy(userId, arg, 'pause');
            case '/resume':   return this.controlStrategy(userId, arg, 'resume');
            case '/pnl':      return this.pnl(userId, arg || null);
            case '/orders':   return this.orders(userId);
            case '/positions':return this.positions(userId);
            case '/paper':    return this.paper(userId);
            case '/alerts':   return this.alerts(userId);
            case '/help':     return HELP_TEXT;
            default:          return `Unknown command: ${cmd}\n\nType /help for a list of commands.`;
        }
    }

    // ─── /status ──────────────────────────────────────────────────────────────

    private async status(userId: string): Promise<string> {
        const strategies = await this.prisma.strategy.findMany({
            where: { userId, status: { in: ['RUNNING', 'PAUSED', 'PAPER'] as any[] } },
            select: { name: true, status: true },
        });

        if (strategies.length === 0) {
            return '📊 No active strategies. Start one in the Polyforge app.';
        }

        const paperPnl = await this.redis.get(`paper:${userId}:pnl`);
        const lines = strategies.map(s => `• ${s.name} [${s.status}]`);
        if (paperPnl) lines.push(`\n📄 Paper P&L: ${parseFloat(paperPnl).toFixed(2)} USDC`);

        return `📊 Active strategies:\n\n${lines.join('\n')}`;
    }

    // ─── /stop, /pause, /resume ────────────────────────────────────────────────

    private async controlStrategy(userId: string, name: string, action: 'stop' | 'pause' | 'resume'): Promise<string> {
        if (!name) return `Usage: /${action} <strategy name>`;

        const strategy = await this.prisma.strategy.findFirst({
            where: { userId, name: { contains: name, mode: 'insensitive' }, status: { not: 'ARCHIVED' as any } },
            select: { id: true, name: true, status: true },
        });

        if (!strategy) {
            return `❌ Strategy "${name}" not found.`;
        }

        try {
            const token = this.issueInternalToken();
            let url: string;
            let method: string;

            if (action === 'stop') {
                url    = `${ENGINE_URL}/internal/strategies/${strategy.id}`;
                method = 'DELETE';
            } else {
                url    = `${ENGINE_URL}/internal/strategies/${strategy.id}/${action}`;
                method = 'POST';
            }

            const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok && res.status !== 204) {
                this.logger.warn(`Engine ${action} returned ${res.status} for strategy ${strategy.id}`);
                return `⚠️ Strategy "${strategy.name}" could not be ${action}ped (engine error ${res.status}).`;
            }
        } catch (err: any) {
            this.logger.error(`Engine ${action} failed: ${err?.message}`);
            return `⚠️ Could not reach strategy engine. Try again shortly.`;
        }

        const verb = action === 'stop' ? 'stopped' : action === 'pause' ? 'paused' : 'resumed';
        return `✅ Strategy "${strategy.name}" ${verb}.`;
    }

    // ─── /pnl ─────────────────────────────────────────────────────────────────

    private async pnl(userId: string, strategyName: string | null): Promise<string> {
        // Real realized P&L: sum from positions
        const agg = await this.prisma.position.aggregate({
            where: { userId },
            _sum: { realizedPnl: true },
        });
        const realizedPnl = Number(agg._sum.realizedPnl ?? 0);

        // Paper P&L from Redis
        const paperRaw = await this.redis.get(`paper:${userId}:pnl`);
        const paperPnl = parseFloat(paperRaw ?? '0');

        if (strategyName) {
            const strategy = await this.prisma.strategy.findFirst({
                where: { userId, name: { contains: strategyName, mode: 'insensitive' }, status: { not: 'ARCHIVED' as any } },
                select: { id: true, name: true },
            });
            if (!strategy) return `❌ Strategy "${strategyName}" not found.`;

            return [
                `📈 P&L for "${strategy.name}"`,
                `(Strategy-level P&L is aggregated across all positions)`,
                `Total realized: ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)} USDC`,
            ].join('\n');
        }

        return [
            '📈 Overall P&L',
            `Realized: ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)} USDC`,
            `Paper:    ${paperPnl >= 0 ? '+' : ''}${paperPnl.toFixed(2)} USDC`,
        ].join('\n');
    }

    // ─── /orders ──────────────────────────────────────────────────────────────

    private async orders(userId: string): Promise<string> {
        const orders = await this.prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { tokenId: true, side: true, size: true, fillPrice: true, status: true, createdAt: true },
        });

        if (orders.length === 0) return '📋 No orders found.';

        const lines = orders.map(o =>
            `• ${o.side} ${Number(o.size).toFixed(2)} @ ${Number(o.fillPrice ?? 0).toFixed(3)} [${o.status}]`
        );
        return `📋 Last ${orders.length} order${orders.length > 1 ? 's' : ''}:\n\n${lines.join('\n')}`;
    }

    // ─── /positions ───────────────────────────────────────────────────────────

    private async positions(userId: string): Promise<string> {
        const positions = await this.prisma.position.findMany({
            where: { userId, resolutionStatus: 'UNRESOLVED' as any },
            select: { tokenId: true, outcome: true, size: true, avgPrice: true, unrealizedPnl: true },
        });

        if (positions.length === 0) return '📦 No open positions.';

        const lines = positions.map(p =>
            `• ${p.tokenId.slice(0, 12)}… ${p.outcome} · ${Number(p.size).toFixed(2)} @ ${Number(p.avgPrice).toFixed(3)} · uPnL: ${Number(p.unrealizedPnl) >= 0 ? '+' : ''}${Number(p.unrealizedPnl).toFixed(2)}`
        );
        return `📦 Open positions (${positions.length}):\n\n${lines.join('\n')}`;
    }

    // ─── /paper ───────────────────────────────────────────────────────────────

    private async paper(userId: string): Promise<string> {
        const [pnlRaw, posCount, orderCount] = await Promise.all([
            this.redis.get(`paper:${userId}:pnl`),
            this.prisma.paperPosition.count({ where: { userId } }),
            this.prisma.paperOrder.count({ where: { userId, status: 'CONFIRMED' as any } }),
        ]);

        const pnl = parseFloat(pnlRaw ?? '0');
        return [
            '📄 Paper trading summary',
            `P&L:     ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDC`,
            `Orders:  ${orderCount}`,
            `Positions: ${posCount}`,
        ].join('\n');
    }

    // ─── /alerts ──────────────────────────────────────────────────────────────

    private async alerts(userId: string): Promise<string> {
        const alerts = await this.prisma.priceAlert.findMany({
            where: { userId, triggered: false },
            select: { tokenId: true, direction: true, price: true },
            take: 10,
        });

        if (alerts.length === 0) return '🔔 No active price alerts.';

        const lines = alerts.map(a =>
            `• ${a.tokenId.slice(0, 12)}… ${a.direction} ${Number(a.price).toFixed(3)}`
        );
        return `🔔 Active alerts (${alerts.length}):\n\n${lines.join('\n')}`;
    }

    // ─── Internal JWT ─────────────────────────────────────────────────────────

    private issueInternalToken(): string {
        return this.jwt.sign(
            { sub: 'bot-service', jti: randomUUID() },
            { secret: INTERNAL_SECRET, audience: 'strategy-engine', expiresIn: '30s' },
        );
    }
}
