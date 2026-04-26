import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "./events.gateway";
import type { IncomingMessage } from "http";
import type WebSocket from "ws";

function makeSocket(overrides: Partial<WebSocket> = {}): WebSocket {
  const sent: string[] = [];
  return {
    readyState: 1,
    send: vi.fn((msg: string) => sent.push(msg)),
    close: vi.fn(),
    terminate: vi.fn(),
    _sent: sent,
    ...overrides,
  } as unknown as WebSocket & { _sent: string[] };
}

function makeRequest(query = "", cookie = ""): IncomingMessage {
  return {
    url: `/ws${query}`,
    headers: { cookie },
  } as unknown as IncomingMessage;
}

describe("EventsGateway", () => {
  let gateway: EventsGateway;
  let jwtService: JwtService;

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
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get(EventsGateway);
    jwtService = module.get(JwtService);

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

    it("closes connection when no token is provided", () => {
      const client = makeSocket();
      const req = makeRequest();

      gateway.handleConnection(client, req);

      expect(client.close).toHaveBeenCalledWith(
        4001,
        "Authentication required",
      );
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
