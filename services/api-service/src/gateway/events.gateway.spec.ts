import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "./events.gateway";
import type { IncomingMessage } from "http";
import type WebSocket from "ws";

function makeSocket(overrides: Partial<WebSocket> = {}): WebSocket {
  const sent: string[] = [];
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    readyState: 1,
    send: vi.fn((msg: string) => sent.push(msg)),
    close: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const arr = handlers.get(event) ?? [];
      arr.push(handler);
      handlers.set(event, arr);
      return undefined;
    }),
    _sent: sent,
    _handlers: handlers,
    ...overrides,
  } as unknown as WebSocket & {
    _sent: string[];
    _handlers: Map<string, Array<(...args: unknown[]) => void>>;
  };
}

function makeRequest(
  query = "",
  cookie = "",
  origin?: string,
): IncomingMessage {
  return {
    url: `/ws${query}`,
    headers: { cookie, ...(origin ? { origin } : {}) },
    socket: { remoteAddress: "203.0.113.9" },
  } as unknown as IncomingMessage;
}

function sendClientMessage(client: WebSocket, message: unknown): void {
  const handlers = (
    client as unknown as {
      _handlers: Map<string, Array<(...args: unknown[]) => void>>;
    }
  )._handlers.get("message");
  handlers?.forEach((handler) => handler(Buffer.from(JSON.stringify(message))));
}

describe("EventsGateway", () => {
  let gateway: EventsGateway;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EventsGateway,
        {
          provide: JwtService,
          useValue: {
            verify: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === "USER_JWT_SECRET")
                return "test-secret-32-chars-minimum-ok!";
              if (key === "CORS_ORIGINS") return "https://app.polyforge.test";
              if (key === "WS_MAX_CONNECTIONS_PER_USER") return 3;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get(EventsGateway);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    gateway.server = { clients: new Set() } as unknown as import("ws").Server;
  });

  describe("handleConnection", () => {
    it("authenticates via query param token and sends AUTH_OK", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-1",
        email: "a@b.com",
        username: "alice",
      });

      const client = makeSocket();
      const req = makeRequest("?token=valid-jwt");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).toHaveBeenCalledWith("valid-jwt", {
        secret: "test-secret-32-chars-minimum-ok!",
      });
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
    });

    it("authenticates a WebSocket upgrade from an allowed Origin", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-1",
        email: "a@b.com",
        username: "alice",
      });

      const client = makeSocket();
      const req = makeRequest(
        "?token=valid-jwt",
        "",
        "https://app.polyforge.test",
      );

      gateway.handleConnection(client, req);

      expect(jwtService.verify).toHaveBeenCalledWith("valid-jwt", {
        secret: "test-secret-32-chars-minimum-ok!",
      });
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
    });

    it("rejects WebSocket upgrades from untrusted Origins before JWT verification", () => {
      const client = makeSocket();
      const req = makeRequest("", "pf_token=cookie-jwt", "https://evil.test");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.close).toHaveBeenCalledWith(4003, "Origin not allowed");
      expect(client.terminate).toHaveBeenCalled();
      expect(client.send).not.toHaveBeenCalled();
    });

    it("authenticates via pf_token cookie", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-2",
        email: "b@c.com",
        username: "bob",
      });

      const client = makeSocket();
      const req = makeRequest("", "pf_token=cookie-jwt; other=val");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).toHaveBeenCalledWith("cookie-jwt", {
        secret: "test-secret-32-chars-minimum-ok!",
      });
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
    });

    it("prefers the pf_token cookie when a query token is also present", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-2",
        email: "b@c.com",
        username: "bob",
      });
      const warnSpy = vi.spyOn(
        gateway["logger"] as { warn: (message: string) => void },
        "warn",
      );

      const client = makeSocket();
      const req = makeRequest("?token=query-jwt", "pf_token=cookie-jwt");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).toHaveBeenCalledWith("cookie-jwt", {
        secret: "test-secret-32-chars-minimum-ok!",
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("warns without leaking token material when legacy query auth is used", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-1",
        email: "a@b.com",
        username: "alice",
      });
      const warnSpy = vi.spyOn(
        gateway["logger"] as { warn: (message: string) => void },
        "warn",
      );

      const client = makeSocket();
      const req = makeRequest("?token=legacy-secret-token");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).toHaveBeenCalledWith("legacy-secret-token", {
        secret: "test-secret-32-chars-minimum-ok!",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        "Deprecated WebSocket query token used from 203.0.113.9",
      );
      expect(warnSpy.mock.calls.flat().join(" ")).not.toContain(
        "legacy-secret-token",
      );
    });

    it("closes connection when no token is provided", () => {
      const client = makeSocket();
      const req = makeRequest();

      gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(
        4001,
        "Authentication required",
      );
    });

    it("rejects cross-origin cookie-authenticated sockets", () => {
      const client = makeSocket();
      const req = makeRequest("", "pf_token=cookie-jwt", "https://evil.test");

      gateway.handleConnection(client, req);

      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.close).toHaveBeenCalledWith(4003, "Origin not allowed");
      expect(client.terminate).toHaveBeenCalled();
    });

    it("closes the oldest socket when a user exceeds the configured limit", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-A",
        email: "a@b.com",
        username: "a",
      });
      vi.mocked(configService.get).mockImplementation((key: string) => {
        if (key === "USER_JWT_SECRET")
          return "test-secret-32-chars-minimum-ok!";
        if (key === "WS_MAX_CONNECTIONS_PER_USER") return "1";
        return undefined;
      });

      const socket1 = makeSocket();
      const socket2 = makeSocket();

      gateway.handleConnection(socket1, makeRequest("?token=t1"));
      gateway.handleConnection(socket2, makeRequest("?token=t2"));

      expect(socket1.close).toHaveBeenCalledWith(
        4008,
        "Connection limit exceeded",
      );
      expect(socket1.terminate).toHaveBeenCalled();
      expect(socket2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
      expect(socket2.close).not.toHaveBeenCalled();
    });

    it("closes connection when JWT verification fails", () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error("invalid token");
      });

      const client = makeSocket();
      const req = makeRequest("?token=bad-jwt");

      gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(4003, "Invalid token");
      expect(client.terminate).toHaveBeenCalled();
    });

    it("closes and terminates when token has no sub claim", () => {
      vi.mocked(jwtService.verify).mockReturnValue({ email: "a@b.com" });

      const client = makeSocket();
      gateway.handleConnection(client, makeRequest("?token=no-sub-jwt"));

      expect(client.close).toHaveBeenCalledWith(4003, "Invalid token");
      expect(client.terminate).toHaveBeenCalled();
      expect(client.send).not.toHaveBeenCalled();
    });

    it("terminates rejected sockets to prevent broadcast leakage", () => {
      const client = makeSocket();
      gateway.handleConnection(client, makeRequest());

      expect(client.terminate).toHaveBeenCalled();
    });
  });

  describe("sendToUser — scoped emission", () => {
    it("sends only to the target user's sockets, not to others", () => {
      vi.mocked(jwtService.verify)
        .mockReturnValueOnce({ sub: "user-A", email: "a@b.com", username: "a" })
        .mockReturnValueOnce({
          sub: "user-B",
          email: "b@c.com",
          username: "b",
        });

      const socketA = makeSocket();
      const socketB = makeSocket();

      gateway.handleConnection(socketA, makeRequest("?token=tokenA"));
      gateway.handleConnection(socketB, makeRequest("?token=tokenB"));

      gateway.sendToUser("user-A", "ORDER_FILLED", { orderId: "123" });

      expect(socketA.send).toHaveBeenCalledWith(
        expect.stringContaining("ORDER_FILLED"),
      );
      // socketB received AUTH_OK on connect but must NOT receive user-A's event
      const bCalls = vi
        .mocked(socketB.send)
        .mock.calls.map((c) => c[0] as string);
      const bEvents = bCalls.map((s) => JSON.parse(s).type);
      expect(bEvents).not.toContain("ORDER_FILLED");
    });

    it("handles multiple sockets for the same user", () => {
      vi.mocked(jwtService.verify)
        .mockReturnValueOnce({ sub: "user-A", email: "a@b.com", username: "a" })
        .mockReturnValueOnce({
          sub: "user-A",
          email: "a@b.com",
          username: "a",
        });

      const socket1 = makeSocket();
      const socket2 = makeSocket();

      gateway.handleConnection(socket1, makeRequest("?token=t1"));
      gateway.handleConnection(socket2, makeRequest("?token=t2"));

      gateway.sendToUser("user-A", "NOTIFICATION", { msg: "hi" });

      expect(socket1.send).toHaveBeenCalledWith(
        expect.stringContaining("NOTIFICATION"),
      );
      expect(socket2.send).toHaveBeenCalledWith(
        expect.stringContaining("NOTIFICATION"),
      );
    });

    it("does nothing when user has no connected sockets", () => {
      expect(() =>
        gateway.sendToUser("nonexistent-user", "EVENT", {}),
      ).not.toThrow();
    });

    it("skips sockets that are not in OPEN state", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-A",
        email: "a@b.com",
        username: "a",
      });

      const closedSocket = makeSocket({ readyState: 3 }); // CLOSED
      gateway.handleConnection(closedSocket, makeRequest("?token=t1"));

      // Reset to not count AUTH_OK
      vi.mocked(closedSocket.send).mockClear();

      gateway.sendToUser("user-A", "EVENT", {});
      expect(closedSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcast — sends to authenticated clients only", () => {
    it("broadcasts to all authenticated clients", () => {
      vi.mocked(jwtService.verify)
        .mockReturnValueOnce({ sub: "user-A", email: "a@b.com", username: "a" })
        .mockReturnValueOnce({
          sub: "user-B",
          email: "b@c.com",
          username: "b",
        });

      const socketA = makeSocket();
      const socketB = makeSocket();

      gateway.handleConnection(socketA, makeRequest("?token=tA"));
      gateway.handleConnection(socketB, makeRequest("?token=tB"));

      // Also add them to server.clients for broadcast
      gateway.server.clients.add(socketA);
      gateway.server.clients.add(socketB);

      gateway.broadcast("PRICE_UPDATE", { tokenId: "t1", price: 0.65 });

      expect(socketA.send).toHaveBeenCalledWith(
        expect.stringContaining("PRICE_UPDATE"),
      );
      expect(socketB.send).toHaveBeenCalledWith(
        expect.stringContaining("PRICE_UPDATE"),
      );
    });

    it("does not broadcast to unauthenticated sockets in server.clients", () => {
      const unauthSocket = makeSocket();
      gateway.server.clients.add(unauthSocket);

      gateway.broadcast("PRICE_UPDATE", { tokenId: "t1", price: 0.5 });

      expect(unauthSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("subscriptions", () => {
    it("pushes price updates only to sockets subscribed to the token", () => {
      vi.mocked(jwtService.verify)
        .mockReturnValueOnce({ sub: "user-A", email: "a@b.com", username: "a" })
        .mockReturnValueOnce({
          sub: "user-B",
          email: "b@c.com",
          username: "b",
        });

      const socketA = makeSocket();
      const socketB = makeSocket();
      gateway.handleConnection(socketA, makeRequest("?token=tA"));
      gateway.handleConnection(socketB, makeRequest("?token=tB"));
      gateway.server.clients.add(socketA);
      gateway.server.clients.add(socketB);

      sendClientMessage(socketA, {
        type: "SUBSCRIBE_PRICES",
        tokenIds: ["token-1"],
      });
      sendClientMessage(socketB, {
        type: "SUBSCRIBE_PRICES",
        tokenIds: ["token-2"],
      });

      vi.mocked(socketA.send).mockClear();
      vi.mocked(socketB.send).mockClear();

      gateway.pushPriceUpdate("token-1", 0.65, 123);

      expect(socketA.send).toHaveBeenCalledWith(
        expect.stringContaining("PRICE_UPDATE"),
      );
      expect(socketB.send).not.toHaveBeenCalled();
    });

    it("responds to client pings", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-A",
        email: "a@b.com",
        username: "a",
      });
      const socket = makeSocket();
      gateway.handleConnection(socket, makeRequest("?token=tA"));
      vi.mocked(socket.send).mockClear();

      sendClientMessage(socket, { type: "PING" });

      expect(socket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"PONG"'),
      );
    });
  });

  describe("per-user connection limit", () => {
    function authAs(userId: string) {
      vi.mocked(jwtService.verify).mockReturnValueOnce({
        sub: userId,
        email: `${userId}@b.com`,
        username: userId,
      });
    }

    it("accepts connections up to the configured per-user max", () => {
      const sockets = Array.from({ length: 3 }, () => makeSocket());
      sockets.forEach((s, i) => {
        authAs("user-A");
        gateway.handleConnection(s, makeRequest(`?token=t${i}`));
      });

      sockets.forEach((s) => {
        expect(s.send).toHaveBeenCalledWith(
          expect.stringContaining('"type":"AUTH_OK"'),
        );
        expect(s.close).not.toHaveBeenCalled();
        expect(s.terminate).not.toHaveBeenCalled();
      });
    });

    it("closes the oldest socket and accepts the next connection past the limit", () => {
      const sockets: ReturnType<typeof makeSocket>[] = [];
      for (let i = 0; i < 3; i++) {
        authAs("user-A");
        const socket = makeSocket();
        gateway.handleConnection(socket, makeRequest(`?token=t${i}`));
        sockets.push(socket);
      }

      authAs("user-A");
      const replacement = makeSocket();
      gateway.handleConnection(replacement, makeRequest("?token=t4"));

      expect(sockets[0].close).toHaveBeenCalledWith(
        4008,
        "Connection limit exceeded",
      );
      expect(sockets[0].terminate).toHaveBeenCalled();
      expect(replacement.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
      expect(replacement.close).not.toHaveBeenCalled();
    });

    it("frees a slot on disconnect so a new connection is accepted", () => {
      const filled: ReturnType<typeof makeSocket>[] = [];
      for (let i = 0; i < 3; i++) {
        authAs("user-A");
        const s = makeSocket();
        gateway.handleConnection(s, makeRequest(`?token=t${i}`));
        filled.push(s);
      }

      gateway.handleDisconnect(filled[0]);

      authAs("user-A");
      const fresh = makeSocket();
      gateway.handleConnection(fresh, makeRequest("?token=tFresh"));

      expect(fresh.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
      expect(fresh.close).not.toHaveBeenCalled();
    });

    it("isolates the limit per user", () => {
      for (let i = 0; i < 3; i++) {
        authAs("user-A");
        gateway.handleConnection(makeSocket(), makeRequest(`?token=tA${i}`));
      }

      authAs("user-B");
      const bSocket = makeSocket();
      gateway.handleConnection(bSocket, makeRequest("?token=tB"));

      expect(bSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
      expect(bSocket.close).not.toHaveBeenCalled();
    });

    it("falls back to the default cap when WS_MAX_CONNECTIONS_PER_USER is unset", async () => {
      const localModule = await Test.createTestingModule({
        providers: [
          EventsGateway,
          {
            provide: JwtService,
            useValue: {
              verify: vi.fn().mockReturnValue({
                sub: "user-X",
                email: "x@b.com",
                username: "x",
              }),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) => {
                if (key === "USER_JWT_SECRET")
                  return "test-secret-32-chars-minimum-ok!";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const localGateway = localModule.get(EventsGateway);
      localGateway.server = {
        clients: new Set(),
      } as unknown as import("ws").Server;

      const sockets: ReturnType<typeof makeSocket>[] = [];
      for (let i = 0; i < 5; i++) {
        const socket = makeSocket();
        localGateway.handleConnection(socket, makeRequest(`?token=t${i}`));
        sockets.push(socket);
      }
      const replacement = makeSocket();
      localGateway.handleConnection(replacement, makeRequest("?token=t6"));

      expect(sockets[0].close).toHaveBeenCalledWith(
        4008,
        "Connection limit exceeded",
      );
      expect(sockets[0].terminate).toHaveBeenCalled();
      expect(replacement.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"AUTH_OK"'),
      );
    });
  });

  describe("handleDisconnect", () => {
    it("removes the socket from the user's set on disconnect", () => {
      vi.mocked(jwtService.verify).mockReturnValue({
        sub: "user-A",
        email: "a@b.com",
        username: "a",
      });

      const client = makeSocket();
      gateway.handleConnection(client, makeRequest("?token=t1"));

      gateway.handleDisconnect(client);

      // After disconnect, sending to user-A should not reach the removed socket
      vi.mocked(client.send).mockClear();
      gateway.sendToUser("user-A", "EVENT", {});
      expect(client.send).not.toHaveBeenCalled();
    });
  });
});
