import { Controller, Get, Post, Delete, Param, Query, Body, Req, Res, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ScenarioService } from '../scenario/scenario.service';
import { TOKENS_BY_ID, MARKETS_BY_ID } from '../fixtures/markets';
import { randomUUID } from 'crypto';

interface MockOrder {
    id: string;
    clobOrderId: string;
    tokenId: string;
    side: 'buy' | 'sell';
    price: string;
    size: string;
    status: 'PENDING' | 'LIVE' | 'MATCHED' | 'CANCELLED' | 'FAILED';
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
            reply.status(503).send({ error: 'Service Unavailable' });
            return false;
        }
        if (this.scenario.shouldRateLimit(ip)) {
            reply.status(429).send({ error: 'Too Many Requests', retryAfter: 60 });
            return false;
        }
        await this.scenario.applyDelay();
        return true;
    }

    // GET /order-book/:tokenId
    @Get('order-book/:tokenId')
    async getOrderBook(
        @Param('tokenId') tokenId: string,
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
    ) {
        if (!await this.guard(reply, req.ip)) return;
        if (!TOKENS_BY_ID.has(tokenId)) return reply.status(404).send({ error: 'Token not found' });

        const { bids, asks } = this.scenario.getOrderBook(tokenId);
        const midpoint = this.scenario.getPrice(tokenId);
        const spread = parseFloat(asks[0].price) - parseFloat(bids[0].price);

        reply.send({
            tokenId,
            bids,
            asks,
            spread: spread.toFixed(4),
            midpoint: midpoint.toFixed(4),
            timestamp: Date.now(),
        });
    }

    // POST /order — place an order
    @Post('order')
    async placeOrder(
        @Body() body: {
            tokenId: string;
            side: 'buy' | 'sell';
            price: string;
            size: string;
            orderType?: 'GTC' | 'FOK' | 'GTD';
        },
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
    ) {
        if (!await this.guard(reply, req.ip)) return;

        const { tokenId, side, price, size, orderType = 'GTC' } = body;

        if (!TOKENS_BY_ID.has(tokenId)) {
            return reply.status(400).send({ error: 'Invalid tokenId', code: 'INVALID_TOKEN' });
        }
        if (!['buy', 'sell'].includes(side)) {
            return reply.status(400).send({ error: 'Invalid side', code: 'INVALID_SIDE' });
        }

        const orderId = randomUUID();
        const clobOrderId = `clob-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const now = new Date().toISOString();

        const order: MockOrder = {
            id: orderId,
            clobOrderId,
            tokenId,
            side,
            price,
            size,
            status: 'PENDING',
            filledSize: '0',
            remainingSize: size,
            avgFillPrice: null,
            createdAt: now,
            updatedAt: now,
        };

        this.orders.set(orderId, order);

        // Simulate fill after delay
        this.simulateFill(orderId, parseFloat(price), parseFloat(size), orderType);

        reply.status(201).send({ orderId, clobOrderId, status: 'PENDING' });
    }

    // DELETE /order/:orderId
    @Delete('order/:orderId')
    async cancelOrder(
        @Param('orderId') orderId: string,
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
    ) {
        if (!await this.guard(reply, req.ip)) return;

        const order = this.orders.get(orderId);
        if (!order) return reply.status(404).send({ error: 'Order not found' });

        if (['MATCHED', 'CANCELLED', 'FAILED'].includes(order.status)) {
            return reply.status(400).send({ error: 'Order cannot be cancelled', code: 'ORDER_NOT_CANCELLABLE' });
        }

        order.status = 'CANCELLED';
        order.updatedAt = new Date().toISOString();

        reply.send({ orderId, status: 'CANCELLED' });
    }

    // GET /order/:orderId
    @Get('order/:orderId')
    async getOrder(
        @Param('orderId') orderId: string,
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
    ) {
        if (!await this.guard(reply, req.ip)) return;

        const order = this.orders.get(orderId);
        if (!order) return reply.status(404).send({ error: 'Order not found' });

        reply.send(order);
    }

    // GET /orders — list all orders (for testing)
    @Get('orders')
    async listOrders(
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
        @Query('status') status?: string,
    ) {
        if (!await this.guard(reply, req.ip)) return;

        let orders = [...this.orders.values()];
        if (status) orders = orders.filter(o => o.status === status.toUpperCase());

        reply.send({ orders, total: orders.length });
    }

    // POST /orders/batch — place up to 15 orders at once
    @Post('orders/batch')
    async placeOrdersBatch(
        @Body() body: { orders: Array<{ tokenId: string; side: 'buy'|'sell'; price: string; size: string }> },
        @Req() req: FastifyRequest,
        @Res() reply: FastifyReply,
    ) {
        if (!await this.guard(reply, req.ip)) return;

        if (!Array.isArray(body.orders) || body.orders.length > 15) {
            return reply.status(400).send({ error: 'Batch size must be 1-15' });
        }

        const results = body.orders.map(o => {
            if (!TOKENS_BY_ID.has(o.tokenId)) return { error: 'Invalid tokenId', tokenId: o.tokenId };

            const orderId = randomUUID();
            const clobOrderId = `clob-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
            const now = new Date().toISOString();
            const order: MockOrder = {
                id: orderId, clobOrderId, tokenId: o.tokenId, side: o.side,
                price: o.price, size: o.size, status: 'PENDING',
                filledSize: '0', remainingSize: o.size, avgFillPrice: null,
                createdAt: now, updatedAt: now,
            };
            this.orders.set(orderId, order);
            this.simulateFill(orderId, parseFloat(o.price), parseFloat(o.size), 'GTC');
            return { orderId, clobOrderId, status: 'PENDING' };
        });

        reply.status(201).send({ results });
    }

    // ─── Simulation ───────────────────────────────────────────────────────────

    private simulateFill(orderId: string, requestedPrice: number, size: number, orderType: string) {
        const fillDelay = this.scenario.fillDelayMs();

        setTimeout(() => {
            const order = this.orders.get(orderId);
            if (!order || order.status !== 'PENDING') return;

            const currentPrice = this.scenario.getPrice(order.tokenId);
            const canFill = orderType === 'FOK'
                ? Math.abs(currentPrice - requestedPrice) < 0.05  // FOK needs exact match
                : true; // GTC always fills eventually

            if (!canFill) {
                order.status = 'CANCELLED';
                order.updatedAt = new Date().toISOString();
                return;
            }

            // Simulate a realistic fill price (slight slippage)
            const slippage = (Math.random() - 0.5) * 0.01;
            const fillPrice = Math.max(0.01, Math.min(0.99, currentPrice + slippage));

            order.status = 'MATCHED';
            order.filledSize = size.toString();
            order.remainingSize = '0';
            order.avgFillPrice = fillPrice.toFixed(4);
            order.updatedAt = new Date().toISOString();
        }, fillDelay);
    }
}
