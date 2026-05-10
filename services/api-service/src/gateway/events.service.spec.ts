import { describe, it, expect, vi } from "vitest";

vi.mock("@polyforge/shared-db", () => ({
  PrismaService: class PrismaService {},
}));

vi.mock("@polyforge/shared-redis", () => ({
  RedisService: class RedisService {},
  PelReclaimService: class PelReclaimService {},
  StreamMonitorService: class StreamMonitorService {},
}));

import { EventsService } from "./events.service";
import { EventsGateway } from "./events.gateway";
import { StrategyEventsService } from "./strategy-events.service";

function makeGateway(): EventsGateway {
  return {
    pushOrderEvent: vi.fn(),
    pushStrategyEvent: vi.fn(),
    pushPriceUpdate: vi.fn(),
    pushWhaleTrade: vi.fn(),
    pushNewsSignal: vi.fn(),
    pushNotification: vi.fn(),
    sendToUser: vi.fn(),
  } as unknown as EventsGateway;
}

function makeStrategyEvents(): StrategyEventsService {
  return {
    emit: vi.fn(),
  } as unknown as StrategyEventsService;
}

describe("EventsService.dispatch()", () => {
  it("forwards reason in ORDER_FAILED payload to the gateway", () => {
    const gateway = makeGateway();
    const strategyEvents = makeStrategyEvents();
    const redis = { getClient: vi.fn() } as any;
    const prisma = {
      whaleFollow: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const webhooks = { dispatch: vi.fn().mockResolvedValue(undefined) } as any;

    const svc = new EventsService(
      redis,
      prisma,
      gateway,
      strategyEvents,
      webhooks,
    );

    (svc as any).dispatch({
      type: "ORDER_FAILED",
      userId: "user-1",
      orderId: "order-abc",
      reason: "signer down",
      ts: "123456",
    });

    expect(gateway.pushOrderEvent).toHaveBeenCalledWith(
      "user-1",
      "ORDER_FAILED",
      { orderId: "order-abc", reason: "signer down", ts: "123456" },
    );
  });

  it("sanitizes multiline reason in ORDER_FAILED", () => {
    const gateway = makeGateway();
    const strategyEvents = makeStrategyEvents();
    const redis = { getClient: vi.fn() } as any;
    const prisma = {
      whaleFollow: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const webhooks = { dispatch: vi.fn().mockResolvedValue(undefined) } as any;

    const svc = new EventsService(
      redis,
      prisma,
      gateway,
      strategyEvents,
      webhooks,
    );

    (svc as any).dispatch({
      type: "ORDER_FAILED",
      userId: "user-1",
      orderId: "order-abc",
      reason: "line1\nline2\r\nline3",
      ts: "123456",
    });

    expect(gateway.pushOrderEvent).toHaveBeenCalledWith(
      "user-1",
      "ORDER_FAILED",
      { orderId: "order-abc", reason: "line1 line2 line3", ts: "123456" },
    );
  });

  it("omits reason when none is present in ORDER_FAILED", () => {
    const gateway = makeGateway();
    const strategyEvents = makeStrategyEvents();
    const redis = { getClient: vi.fn() } as any;
    const prisma = {
      whaleFollow: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const webhooks = { dispatch: vi.fn().mockResolvedValue(undefined) } as any;

    const svc = new EventsService(
      redis,
      prisma,
      gateway,
      strategyEvents,
      webhooks,
    );

    (svc as any).dispatch({
      type: "ORDER_FAILED",
      userId: "user-1",
      orderId: "order-abc",
      ts: "123456",
    });

    expect(gateway.pushOrderEvent).toHaveBeenCalledWith(
      "user-1",
      "ORDER_FAILED",
      { orderId: "order-abc", reason: undefined, ts: "123456" },
    );
  });

  it("still includes reason only for ORDER_FAILED, not ORDER_PLACED", () => {
    const gateway = makeGateway();
    const strategyEvents = makeStrategyEvents();
    const redis = { getClient: vi.fn() } as any;
    const prisma = {
      whaleFollow: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const webhooks = { dispatch: vi.fn().mockResolvedValue(undefined) } as any;

    const svc = new EventsService(
      redis,
      prisma,
      gateway,
      strategyEvents,
      webhooks,
    );

    (svc as any).dispatch({
      type: "ORDER_PLACED",
      userId: "user-1",
      orderId: "order-abc",
      reason: "should not appear",
      intentId: "intent-1",
      ts: "123456",
    });

    expect(gateway.pushOrderEvent).toHaveBeenCalledWith(
      "user-1",
      "ORDER_PLACED",
      { orderId: "order-abc", intentId: "intent-1", ts: "123456" },
    );
  });
});
