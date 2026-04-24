import { describe, it, expect, vi, beforeEach } from "vitest";
import { PolymarketCtfService } from "./ctf.service";
import {
  PolymarketRelayerService,
  type RelayerAuthHeaders,
} from "../relayer/relayer.service";

function makeRelayerMock(): PolymarketRelayerService {
  return {
    submitTransaction: vi.fn().mockResolvedValue({
      transactionID: "tx-ctf-123",
      state: "STATE_NEW",
    }),
  } as any;
}

const AUTH: RelayerAuthHeaders = {
  RELAYER_API_KEY: "rk-test",
  RELAYER_API_KEY_ADDRESS: "0xaddr",
};

const SIGNER = "0xsigner";
const PROXY = "0xproxy";
const NONCE = "5";
const SIGNATURE = "0xsig";

describe("PolymarketCtfService", () => {
  let svc: PolymarketCtfService;
  let relayer: PolymarketRelayerService;

  beforeEach(() => {
    relayer = makeRelayerMock();
    svc = new PolymarketCtfService(relayer);
  });

  // ── encodeSplit ─────────────────────────────────────────────────────────

  describe("encodeSplit()", () => {
    it("encodes split parameters with function selector", () => {
      const data = svc.encodeSplit({
        conditionId: "0x" + "ab".repeat(32),
        amount: "1000000",
        partition: [1, 2],
      });
      expect(data).toMatch(/^0x5eb02767/);
      expect(data.length).toBeGreaterThan(10);
    });

    it("handles conditionId without 0x prefix", () => {
      const data = svc.encodeSplit({
        conditionId: "ab".repeat(32),
        amount: "1000000",
        partition: [1],
      });
      expect(data).toMatch(/^0x5eb02767/);
    });

    it("encodes amount as hex", () => {
      const data = svc.encodeSplit({
        conditionId: "0x" + "00".repeat(32),
        amount: "256",
        partition: [1],
      });
      expect(data).toContain("100".padStart(64, "0"));
    });
  });

  // ── encodeMerge ────────────────────────────────────────────────────────

  describe("encodeMerge()", () => {
    it("encodes merge parameters with function selector", () => {
      const data = svc.encodeMerge({
        conditionId: "0x" + "cd".repeat(32),
        collectionIds: ["0x" + "01".repeat(32)],
        amount: "500000",
      });
      expect(data).toMatch(/^0x3d78bca8/);
    });

    it("encodes multiple collection IDs", () => {
      const data = svc.encodeMerge({
        conditionId: "0x" + "cd".repeat(32),
        collectionIds: ["0x" + "01".repeat(32), "0x" + "02".repeat(32)],
        amount: "500000",
      });
      expect(data.length).toBeGreaterThan(
        svc.encodeMerge({
          conditionId: "0x" + "cd".repeat(32),
          collectionIds: ["0x" + "01".repeat(32)],
          amount: "500000",
        }).length,
      );
    });
  });

  // ── encodeRedeem ───────────────────────────────────────────────────────

  describe("encodeRedeem()", () => {
    it("encodes redeem parameters with function selector", () => {
      const data = svc.encodeRedeem({
        conditionId: "0x" + "ef".repeat(32),
        positionId: "0x" + "ff".repeat(32),
        amount: "1000000",
      });
      expect(data).toMatch(/^0x49b3d18a/);
    });

    it("handles positionId without 0x prefix", () => {
      const data = svc.encodeRedeem({
        conditionId: "ef".repeat(32),
        positionId: "ff".repeat(32),
        amount: "100",
      });
      expect(data).toMatch(/^0x49b3d18a/);
    });
  });

  // ── encodeNegRiskConvert ───────────────────────────────────────────────

  describe("encodeNegRiskConvert()", () => {
    it("encodes neg risk convert with function selector", () => {
      const data = svc.encodeNegRiskConvert({
        conditionId: "0x" + "aa".repeat(32),
        tokenId: "0x" + "bb".repeat(32),
        amount: "1000000",
        outcomeCount: 3,
      });
      expect(data).toMatch(/^0x7d4b1e8a/);
    });

    it("encodes outcome count as hex", () => {
      const data = svc.encodeNegRiskConvert({
        conditionId: "0x" + "00".repeat(32),
        tokenId: "0x" + "00".repeat(32),
        amount: "100",
        outcomeCount: 5,
      });
      expect(data).toContain("5".padStart(64, "0"));
    });
  });

  // ── splitViaRelayer ────────────────────────────────────────────────────

  describe("splitViaRelayer()", () => {
    it("submits split transaction to relayer", async () => {
      const result = await svc.splitViaRelayer(
        {
          conditionId: "0x" + "ab".repeat(32),
          amount: "1000000",
          partition: [1, 2],
        },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      expect(result.operation).toBe("split");
      expect(result.transactionID).toBe("tx-ctf-123");
      expect(result.encodedData).toMatch(/^0x5eb02767/);
    });

    it("calls relayer with CTF contract address", async () => {
      await svc.splitViaRelayer(
        { conditionId: "0x" + "ab".repeat(32), amount: "1000", partition: [1] },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      const call = (relayer.submitTransaction as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(call[0].to).toBe("0x4D97DCd97eC945f40cF65F87097ACe5EA0476045");
      expect(call[0].from).toBe(SIGNER);
      expect(call[0].type).toBe("SAFE");
    });
  });

  // ── mergeViaRelayer ────────────────────────────────────────────────────

  describe("mergeViaRelayer()", () => {
    it("submits merge transaction to relayer", async () => {
      const result = await svc.mergeViaRelayer(
        {
          conditionId: "0x" + "cd".repeat(32),
          collectionIds: ["0x" + "01".repeat(32)],
          amount: "500000",
        },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      expect(result.operation).toBe("merge");
      expect(result.transactionID).toBe("tx-ctf-123");
      expect(result.encodedData).toMatch(/^0x3d78bca8/);
    });
  });

  // ── redeemViaRelayer ───────────────────────────────────────────────────

  describe("redeemViaRelayer()", () => {
    it("submits redeem transaction to relayer", async () => {
      const result = await svc.redeemViaRelayer(
        {
          conditionId: "0x" + "ef".repeat(32),
          positionId: "0x" + "ff".repeat(32),
          amount: "1000000",
        },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      expect(result.operation).toBe("redeem");
      expect(result.transactionID).toBe("tx-ctf-123");
      expect(result.encodedData).toMatch(/^0x49b3d18a/);
    });
  });

  // ── convertNegRiskViaRelayer ───────────────────────────────────────────

  describe("convertNegRiskViaRelayer()", () => {
    it("submits neg risk convert to relayer via adapter", async () => {
      const result = await svc.convertNegRiskViaRelayer(
        {
          conditionId: "0x" + "aa".repeat(32),
          tokenId: "0x" + "bb".repeat(32),
          amount: "1000000",
          outcomeCount: 3,
        },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      expect(result.operation).toBe("convert");
      expect(result.transactionID).toBe("tx-ctf-123");
    });

    it("uses Neg Risk Adapter contract address", async () => {
      await svc.convertNegRiskViaRelayer(
        {
          conditionId: "0x" + "aa".repeat(32),
          tokenId: "0x" + "bb".repeat(32),
          amount: "1000",
          outcomeCount: 2,
        },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      const call = (relayer.submitTransaction as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(call[0].to).toBe("0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296");
    });
  });

  // ── relayer error propagation ──────────────────────────────────────────

  describe("error propagation", () => {
    it("propagates relayer errors on split", async () => {
      (relayer.submitTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Relayer API error 401: Unauthorized"),
      );
      await expect(
        svc.splitViaRelayer(
          {
            conditionId: "0x" + "ab".repeat(32),
            amount: "1000",
            partition: [1],
          },
          SIGNER,
          PROXY,
          NONCE,
          SIGNATURE,
          AUTH,
        ),
      ).rejects.toThrow("401");
    });

    it("propagates relayer errors on neg risk convert", async () => {
      (relayer.submitTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Relayer API error 429: rate limit exhausted"),
      );
      await expect(
        svc.convertNegRiskViaRelayer(
          {
            conditionId: "0x" + "aa".repeat(32),
            tokenId: "0x" + "bb".repeat(32),
            amount: "1000",
            outcomeCount: 2,
          },
          SIGNER,
          PROXY,
          NONCE,
          SIGNATURE,
          AUTH,
        ),
      ).rejects.toThrow("429");
    });
  });

  // ── contract addresses ─────────────────────────────────────────────────

  describe("contract addresses", () => {
    it("returns CTF contract address", () => {
      expect(svc.getCtfContractAddress()).toBe(
        "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
      );
    });

    it("returns Neg Risk Adapter address", () => {
      expect(svc.getNegRiskAdapterAddress()).toBe(
        "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
      );
    });

    it("returns Neg Risk Exchange address", () => {
      expect(svc.getNegRiskExchangeAddress()).toBe(
        "0xC5d563A36AE78145C45a50134d48A1215220f80a",
      );
    });
  });

  // ── signatureParams defaults ───────────────────────────────────────────

  describe("signatureParams defaults", () => {
    it("sends zero gasPrice for gasless transactions", async () => {
      await svc.splitViaRelayer(
        { conditionId: "0x" + "ab".repeat(32), amount: "1000", partition: [1] },
        SIGNER,
        PROXY,
        NONCE,
        SIGNATURE,
        AUTH,
      );
      const call = (relayer.submitTransaction as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(call[0].signatureParams.gasPrice).toBe("0");
      expect(call[0].signatureParams.gasToken).toBe(
        "0x0000000000000000000000000000000000000000",
      );
    });
  });
});
