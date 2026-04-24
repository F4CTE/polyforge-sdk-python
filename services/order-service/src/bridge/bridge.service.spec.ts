import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PolymarketBridgeService } from "./bridge.service";

function makeConfig(url = "http://bridge:3099"): ConfigService {
  return {
    get: (k: string, d?: string) =>
      k === "POLYMARKET_BRIDGE_URL" ? url : (d ?? ""),
    getOrThrow: (k: string) => {
      if (k === "POLYMARKET_BRIDGE_URL") return url;
      throw new Error(`Missing ${k}`);
    },
  } as any;
}

describe("PolymarketBridgeService", () => {
  let svc: PolymarketBridgeService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    svc = new PolymarketBridgeService(makeConfig());
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── createDepositAddresses ──────────────────────────────────────────────

  describe("createDepositAddresses()", () => {
    const DEPOSIT_REQ = {
      address: "0x56687bf447db6ffa42ffe2204a05edaa20f55839",
    };
    const DEPOSIT_RESP = {
      address: {
        evm: "0x23566f8b2E82aDfCf01846E54899d110e97AC053",
        svm: "CrvTBvzryYxBHbWu2TiQpcqD5M7Le7iBKzVmEj3f36Jb",
        btc: "bc1q8eau83qffxcj8ht4hsjdza3lha9r3egfqysj3g",
      },
      note: "Supported chains and tokens",
    };

    it("POSTs to /deposit", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(DEPOSIT_RESP),
      });
      await svc.createDepositAddresses(DEPOSIT_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://bridge:3099/deposit");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("sends address in request body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(DEPOSIT_RESP),
      });
      await svc.createDepositAddresses(DEPOSIT_REQ);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.address).toBe(DEPOSIT_REQ.address);
    });

    it("returns multi-chain deposit addresses", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(DEPOSIT_RESP),
      });
      const result = await svc.createDepositAddresses(DEPOSIT_REQ);
      expect(result.address.evm).toBe(DEPOSIT_RESP.address.evm);
      expect(result.address.svm).toBe(DEPOSIT_RESP.address.svm);
      expect(result.address.btc).toBe(DEPOSIT_RESP.address.btc);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Invalid address"),
      });
      await expect(svc.createDepositAddresses(DEPOSIT_REQ)).rejects.toThrow(
        "400",
      );
    });
  });

  // ── createWithdrawalAddresses ───────────────────────────────────────────

  describe("createWithdrawalAddresses()", () => {
    const WITHDRAWAL_REQ = {
      address: "0x9156dd10bea4c8d7e2d591b633d1694b1d764756",
      toChainId: "1",
      toTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      recipientAddr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    };

    it("POSTs to /withdraw", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          address: { evm: "0xabc", svm: "xyz", btc: "bc1" },
        }),
      });
      await svc.createWithdrawalAddresses(WITHDRAWAL_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://bridge:3099/withdraw");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("sends all withdrawal fields in body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          address: { evm: "0x", svm: "x", btc: "b" },
        }),
      });
      await svc.createWithdrawalAddresses(WITHDRAWAL_REQ);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.toChainId).toBe("1");
      expect(body.recipientAddr).toBe(WITHDRAWAL_REQ.recipientAddr);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Server error"),
      });
      await expect(
        svc.createWithdrawalAddresses(WITHDRAWAL_REQ),
      ).rejects.toThrow("500");
    });
  });

  // ── getQuote ────────────────────────────────────────────────────────────

  describe("getQuote()", () => {
    const QUOTE_REQ = {
      fromAmountBaseUnit: "1000000",
      fromChainId: "1",
      fromTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      recipientAddress: "0x56687bf447db6ffa42ffe2204a05edaa20f55839",
      toChainId: "137",
      toTokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    };
    const QUOTE_RESP = {
      quoteId: "q-123",
      estCheckoutTimeMs: 120000,
      estInputUsd: 1.0,
      estOutputUsd: 0.99,
      estToTokenBaseUnit: "990000",
      estFeeBreakdown: {
        appFeeUsd: 0,
        fillCostUsd: 0.005,
        gasUsd: 0.005,
        totalImpactUsd: 0.01,
      },
    };

    it("POSTs to /quote", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(QUOTE_RESP),
      });
      await svc.getQuote(QUOTE_REQ);
      expect(fetchSpy.mock.calls[0][0]).toBe("http://bridge:3099/quote");
      expect(fetchSpy.mock.calls[0][1].method).toBe("POST");
    });

    it("sends all quote fields in body", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(QUOTE_RESP),
      });
      await svc.getQuote(QUOTE_REQ);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body.fromAmountBaseUnit).toBe("1000000");
      expect(body.fromChainId).toBe("1");
    });

    it("returns quote with fee breakdown", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(QUOTE_RESP),
      });
      const result = await svc.getQuote(QUOTE_REQ);
      expect(result.quoteId).toBe("q-123");
      expect(result.estFeeBreakdown.gasUsd).toBe(0.005);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad request"),
      });
      await expect(svc.getQuote(QUOTE_REQ)).rejects.toThrow("400");
    });
  });

  // ── getSupportedAssets ──────────────────────────────────────────────────

  describe("getSupportedAssets()", () => {
    const ASSETS_RESP = {
      supportedAssets: [
        {
          chainId: "1",
          chainName: "Ethereum",
          token: {
            name: "USD Coin",
            symbol: "USDC",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            decimals: 6,
          },
          minCheckoutUsd: 1.0,
        },
      ],
    };

    it("sends GET to /supported-assets", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(ASSETS_RESP),
      });
      await svc.getSupportedAssets();
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://bridge:3099/supported-assets",
      );
    });

    it("does not set method (defaults to GET)", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(ASSETS_RESP),
      });
      await svc.getSupportedAssets();
      expect(fetchSpy.mock.calls[0][1].method).toBeUndefined();
    });

    it("returns supported assets with chain and token details", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(ASSETS_RESP),
      });
      const result = await svc.getSupportedAssets();
      expect(result.supportedAssets).toHaveLength(1);
      expect(result.supportedAssets[0].chainName).toBe("Ethereum");
      expect(result.supportedAssets[0].token.symbol).toBe("USDC");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("error"),
      });
      await expect(svc.getSupportedAssets()).rejects.toThrow("500");
    });
  });

  // ── getTransactionStatus ───────────────────────────────────────────────

  describe("getTransactionStatus()", () => {
    const STATUS_RESP = {
      transactions: [
        {
          fromChainId: "1",
          fromTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          fromAmountBaseUnit: "1000000",
          toChainId: "137",
          toTokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          status: "COMPLETED" as const,
          txHash: "0xabc123",
          createdTimeMs: 1700000000000,
        },
      ],
    };

    it("sends GET to /status/{address}", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(STATUS_RESP),
      });
      await svc.getTransactionStatus("0xdeposit");
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://bridge:3099/status/0xdeposit",
      );
    });

    it("URL-encodes the address", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(STATUS_RESP),
      });
      await svc.getTransactionStatus("addr+special");
      expect(fetchSpy.mock.calls[0][0]).toContain("addr%2Bspecial");
    });

    it("returns transactions with status", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(STATUS_RESP),
      });
      const result = await svc.getTransactionStatus("0xdeposit");
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].status).toBe("COMPLETED");
      expect(result.transactions[0].txHash).toBe("0xabc123");
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Missing address"),
      });
      await expect(svc.getTransactionStatus("")).rejects.toThrow("400");
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

    it("retries on 429 and succeeds on next attempt", async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ supportedAssets: [] }),
        });

      const promise = svc.getSupportedAssets();
      await vi.advanceTimersByTimeAsync(600);
      const result = await promise;

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.supportedAssets).toEqual([]);
    });

    it("throws after exhausting retries on repeated 429", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      });

      const promise = svc.getSupportedAssets();
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

      await expect(svc.getSupportedAssets()).rejects.toThrow("500");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── URL config ─────────────────────────────────────────────────────────

  describe("URL configuration", () => {
    it("uses default URL when not configured", () => {
      const defaultConfig = {
        get: (_k: string, d?: string) => d ?? "",
      } as any;
      const defaultSvc = new PolymarketBridgeService(defaultConfig);
      expect(defaultSvc).toBeDefined();
    });

    it("uses custom bridge URL from config", async () => {
      const customSvc = new PolymarketBridgeService(
        makeConfig("http://custom-bridge:8080"),
      );
      fetchSpy.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ supportedAssets: [] }),
      });
      await customSvc.getSupportedAssets();
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "http://custom-bridge:8080/supported-assets",
      );
    });
  });
});
