import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import {
  PolymarketRelayerService,
  type RelayerAuthHeaders,
} from "./relayer.service";

function makeConfig(url = "http://relayer:3099"): ConfigService {
  return {
    get: (k: string, d?: string) =>
      k === "POLYMARKET_RELAYER_URL" ? url : (d ?? ""),
    getOrThrow: (k: string) => {
      if (k === "POLYMARKET_RELAYER_URL") return url;
      throw new Error(`Missing ${k}`);
    },
  } as any;
}

const AUTH: RelayerAuthHeaders = {
  RELAYER_API_KEY: "rk-test",
  RELAYER_API_KEY_ADDRESS: "0xaddr",
};

describe("PolymarketRelayerService", () => {
  let svc: PolymarketRelayerService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = new PolymarketRelayerService(makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── checkSafeDeployed ──────────────────────────────────────────────────

  describe("checkSafeDeployed()", () => {
    it("sends GET to /deployed with address query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ deployed: true }),
      });
      const result = await svc.checkSafeDeployed("0x6d8c4e9a");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://relayer:3099/deployed?address=0x6d8c4e9a",
      );
      expect(result.deployed).toBe(true);
    });

    it("returns false when safe is not deployed", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ deployed: false }),
      });
      const result = await svc.checkSafeDeployed("0xnew");
      expect(result.deployed).toBe(false);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Invalid address"),
      });
      await expect(svc.checkSafeDeployed("bad")).rejects.toThrow("400");
    });
  });

  // ── getTransaction ─────────────────────────────────────────────────────

  describe("getTransaction()", () => {
    const TX = {
      transactionID: "0190b317-a1d3-7bec-9b91-eeb6dcd3a620",
      transactionHash: "0xhash",
      from: "0xfrom",
      to: "0xto",
      proxyAddress: "0xproxy",
      data: "0xdata",
      nonce: "5",
      value: "0",
      signature: "0xsig",
      state: "STATE_CONFIRMED",
      type: "SAFE",
      owner: "0xowner",
      metadata: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:01:00Z",
    };

    it("sends GET to /transaction with id query param", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([TX]),
      });
      await svc.getTransaction("0190b317-a1d3-7bec-9b91-eeb6dcd3a620");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://relayer:3099/transaction?id=0190b317-a1d3-7bec-9b91-eeb6dcd3a620",
      );
    });

    it("returns transaction array", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([TX]),
      });
      const result = await svc.getTransaction("tx-id");
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe("STATE_CONFIRMED");
      expect(result[0].type).toBe("SAFE");
    });

    it("throws on 404", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Not found"),
      });
      await expect(svc.getTransaction("bad")).rejects.toThrow("404");
    });
  });

  // ── getNonce ───────────────────────────────────────────────────────────

  describe("getNonce()", () => {
    it("sends GET to /nonce with address and type params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ nonce: "31" }),
      });
      const result = await svc.getNonce("0xaddr", "SAFE");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://relayer:3099/nonce?address=0xaddr&type=SAFE",
      );
      expect(result.nonce).toBe("31");
    });

    it("supports PROXY type", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ nonce: "0" }),
      });
      await svc.getNonce("0xaddr", "PROXY");
      expect(fetchSpy.mock.calls[0][0]).toContain("type=PROXY");
    });

    it("throws on invalid address", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("invalid address"),
      });
      await expect(svc.getNonce("bad", "SAFE")).rejects.toThrow("400");
    });
  });

  // ── getRecentTransactions ──────────────────────────────────────────────

  describe("getRecentTransactions()", () => {
    it("sends GET to /transactions with auth headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      });
      await svc.getRecentTransactions(AUTH);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://relayer:3099/transactions",
      );
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers.RELAYER_API_KEY).toBe("rk-test");
      expect(headers.RELAYER_API_KEY_ADDRESS).toBe("0xaddr");
    });

    it("returns transaction array", async () => {
      const txs = [{ transactionID: "t1", state: "STATE_NEW" }];
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(txs),
      });
      const result = await svc.getRecentTransactions(AUTH);
      expect(result).toHaveLength(1);
    });

    it("throws on 401 unauthorized", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });
      await expect(svc.getRecentTransactions(AUTH)).rejects.toThrow("401");
    });
  });

  // ── getRelayerAddress ──────────────────────────────────────────────────

  describe("getRelayerAddress()", () => {
    it("sends GET to /relay-payload with address and type params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          address: "0x4da9395388791c22684e03779c3de10934eb9cfb",
          nonce: "31",
        }),
      });
      const result = await svc.getRelayerAddress("0xaddr", "SAFE");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://relayer:3099/relay-payload?address=0xaddr&type=SAFE",
      );
      expect(result.address).toBe("0x4da9395388791c22684e03779c3de10934eb9cfb");
      expect(result.nonce).toBe("31");
    });

    it("throws on bad address", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("invalid address"),
      });
      await expect(svc.getRelayerAddress("bad", "SAFE")).rejects.toThrow("400");
    });
  });

  // ── submitTransaction ──────────────────────────────────────────────────

  describe("submitTransaction()", () => {
    const SUBMIT_REQ = {
      from: "0xfrom",
      to: "0xto",
      proxyWallet: "0xproxy",
      data: "0xdata",
      nonce: "5",
      signature: "0xsig",
      signatureParams: {
        gasPrice: "0",
        operation: "0",
        safeTxnGas: "0",
        baseGas: "0",
        gasToken: "0x0000000000000000000000000000000000000000",
        refundReceiver: "0x0000000000000000000000000000000000000000",
      },
      type: "SAFE" as const,
    };

    it("POSTs to /submit with auth headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          transactionID: "tx-123",
          state: "STATE_NEW",
        }),
      });
      await svc.submitTransaction(SUBMIT_REQ, AUTH);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://relayer:3099/submit");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers.RELAYER_API_KEY).toBe("rk-test");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("sends full request body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          transactionID: "tx-123",
          state: "STATE_NEW",
        }),
      });
      await svc.submitTransaction(SUBMIT_REQ, AUTH);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.from).toBe("0xfrom");
      expect(body.type).toBe("SAFE");
      expect(body.signatureParams.operation).toBe("0");
    });

    it("returns transaction ID and state", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          transactionID: "tx-456",
          state: "STATE_NEW",
        }),
      });
      const result = await svc.submitTransaction(SUBMIT_REQ, AUTH);
      expect(result.transactionID).toBe("tx-456");
      expect(result.state).toBe("STATE_NEW");
    });

    it("throws on 400 invalid payload", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Invalid payload"),
      });
      await expect(svc.submitTransaction(SUBMIT_REQ, AUTH)).rejects.toThrow(
        "400",
      );
    });

    it("throws on 401 authentication failure", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });
      await expect(svc.submitTransaction(SUBMIT_REQ, AUTH)).rejects.toThrow(
        "401",
      );
    });
  });

  // ── getApiKeys ─────────────────────────────────────────────────────────

  describe("getApiKeys()", () => {
    it("sends GET to /api-keys with auth headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ key: "rk-1", active: true }]),
      });
      const result = await svc.getApiKeys(AUTH);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://relayer:3099/api-keys");
      const headers = fetchSpy.mock.calls[0][1].headers;
      expect(headers.RELAYER_API_KEY).toBe("rk-test");
      expect(result).toHaveLength(1);
    });

    it("throws on 401", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("Unauthorized"),
      });
      await expect(svc.getApiKeys(AUTH)).rejects.toThrow("401");
    });
  });

  // ── 429 retry ──────────────────────────────────────────────────────────

  describe("429 retry behaviour", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries on 429 and succeeds", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ deployed: true }),
        });

      const promise = svc.checkSafeDeployed("0xaddr");
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.deployed).toBe(true);
    });

    it("throws after exhausting retries", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      });

      const promise = svc.checkSafeDeployed("0xaddr");
      const assertion = expect(promise).rejects.toThrow("429");
      await vi.advanceTimersByTimeAsync(4000);
      await assertion;

      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it("does NOT retry on 500", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("server error"),
      });

      await expect(svc.checkSafeDeployed("0xaddr")).rejects.toThrow("500");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── URL config ─────────────────────────────────────────────────────────

  describe("URL configuration", () => {
    it("uses custom relayer URL from config", async () => {
      const customSvc = new PolymarketRelayerService(
        makeConfig("http://custom-relayer:8080"),
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ deployed: false }),
      });
      await customSvc.checkSafeDeployed("0xaddr");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://custom-relayer:8080/deployed?address=0xaddr",
      );
    });
  });
});
