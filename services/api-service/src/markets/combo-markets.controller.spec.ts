import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ComboMarketsController } from "./combo-markets.controller";
import { KalshiReadService } from "./kalshi-read.service";

function makeKalshiRead(): KalshiReadService {
  return {
    getCollections: vi.fn().mockResolvedValue({ collections: [], cursor: "" }),
    getCollection: vi.fn().mockResolvedValue(null),
    lookupTicker: vi.fn().mockResolvedValue(null),
  } as unknown as KalshiReadService;
}

describe("ComboMarketsController", () => {
  let ctrl: ComboMarketsController;
  let kalshi: ReturnType<typeof makeKalshiRead>;

  beforeEach(() => {
    kalshi = makeKalshiRead();
    ctrl = new ComboMarketsController(kalshi);
  });

  describe("listCollections", () => {
    it("delegates to KalshiReadService.getCollections", async () => {
      const collections = [
        {
          collection_ticker: "NBA-COMBO",
          title: "NBA",
          category: "sports",
          status: "active",
          markets_count: 5,
        },
      ];
      (kalshi.getCollections as ReturnType<typeof vi.fn>).mockResolvedValue({
        collections,
        cursor: "abc",
      });

      const result = await ctrl.listCollections({ seriesTicker: "NBA" });
      expect(result.collections).toHaveLength(1);
      expect(kalshi.getCollections).toHaveBeenCalledWith(
        "NBA",
        undefined,
        undefined,
      );
    });
  });

  describe("getCollection", () => {
    it("returns a collection by ticker", async () => {
      const collection = {
        collection_ticker: "NBA-COMBO",
        title: "NBA Championship Combo",
        category: "sports",
        status: "active",
        markets_count: 12,
      };
      (kalshi.getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(
        collection,
      );

      const result = await ctrl.getCollection("NBA-COMBO");
      expect(result.collection_ticker).toBe("NBA-COMBO");
    });

    it("throws NotFoundException when collection not found", async () => {
      await expect(ctrl.getCollection("NONEXISTENT")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("lookupTicker", () => {
    it("resolves a combo market ticker", async () => {
      (kalshi.lookupTicker as ReturnType<typeof vi.fn>).mockResolvedValue({
        event_ticker: "NBA-COMBO-EVT",
        market_ticker: "NBA-COMBO-MKT-1234",
      });

      const result = await ctrl.lookupTicker({
        collectionTicker: "NBA-COMBO",
        legs: [
          { ticker: "NBA-WC-LAKERS", outcome: "yes" },
          { ticker: "NBA-EC-CELTICS", outcome: "yes" },
        ],
      });

      expect(result.market_ticker).toBe("NBA-COMBO-MKT-1234");
      expect(kalshi.lookupTicker).toHaveBeenCalledWith("NBA-COMBO", [
        { ticker: "NBA-WC-LAKERS", outcome: "yes" },
        { ticker: "NBA-EC-CELTICS", outcome: "yes" },
      ]);
    });

    it("throws NotFoundException when no combo market found", async () => {
      await expect(
        ctrl.lookupTicker({
          collectionTicker: "INVALID",
          legs: [{ ticker: "X", outcome: "yes" }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
