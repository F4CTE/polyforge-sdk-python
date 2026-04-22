import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketMatchController } from "./market-match.controller";
import { BadRequestException, NotFoundException } from "@nestjs/common";

function makeMatchService() {
  return {
    listMatches: vi.fn().mockResolvedValue([]),
    getMatchesForMarket: vi.fn().mockResolvedValue([]),
    createManualMatch: vi.fn().mockResolvedValue({ id: "match-1" }),
    verifyMatch: vi.fn().mockResolvedValue({ id: "match-1", verified: true }),
    deleteMatch: vi.fn().mockResolvedValue(undefined),
    runAutoMatch: vi.fn().mockResolvedValue({ created: 1, skipped: 0 }),
  } as any;
}

function makeArbitrageService() {
  return {
    getPriceComparison: vi.fn().mockResolvedValue({ spread: 0.02 }),
    findOpportunities: vi.fn().mockResolvedValue([]),
  } as any;
}

describe("MarketMatchController", () => {
  let controller: MarketMatchController;
  let matchService: ReturnType<typeof makeMatchService>;
  let arbitrageService: ReturnType<typeof makeArbitrageService>;

  beforeEach(() => {
    matchService = makeMatchService();
    arbitrageService = makeArbitrageService();
    controller = new MarketMatchController(matchService, arbitrageService);
  });

  describe("listMatches", () => {
    it("passes parsed query params to service", async () => {
      await controller.listMatches("true", "0.8", "10", "5");
      expect(matchService.listMatches).toHaveBeenCalledWith({
        verifiedOnly: true,
        minConfidence: 0.8,
        limit: 10,
        offset: 5,
      });
    });

    it("defaults optional params to undefined", async () => {
      await controller.listMatches();
      expect(matchService.listMatches).toHaveBeenCalledWith({
        verifiedOnly: false,
        minConfidence: undefined,
        limit: undefined,
        offset: undefined,
      });
    });
  });

  describe("matchesForMarket", () => {
    it("delegates to service", async () => {
      await controller.matchesForMarket("m1");
      expect(matchService.getMatchesForMarket).toHaveBeenCalledWith("m1");
    });
  });

  describe("createManualMatch", () => {
    it("creates match with valid body", async () => {
      await controller.createManualMatch({
        polymarketId: "p1",
        kalshiId: "k1",
      });
      expect(matchService.createManualMatch).toHaveBeenCalledWith("p1", "k1");
    });

    it("throws BadRequestException when polymarketId missing", async () => {
      await expect(
        controller.createManualMatch({ polymarketId: "", kalshiId: "k1" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("verifyMatch", () => {
    it("delegates to service", async () => {
      await controller.verifyMatch("match-1");
      expect(matchService.verifyMatch).toHaveBeenCalledWith("match-1");
    });

    it("throws NotFoundException on error", async () => {
      matchService.verifyMatch.mockRejectedValue(new Error("not found"));
      await expect(controller.verifyMatch("bad")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("deleteMatch", () => {
    it("delegates to service", async () => {
      await controller.deleteMatch("match-1");
      expect(matchService.deleteMatch).toHaveBeenCalledWith("match-1");
    });

    it("throws NotFoundException on error", async () => {
      matchService.deleteMatch.mockRejectedValue(new Error("not found"));
      await expect(controller.deleteMatch("bad")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("triggerAutoMatch", () => {
    it("delegates to service", async () => {
      const result = await controller.triggerAutoMatch();
      expect(result).toEqual({ created: 1, skipped: 0 });
    });
  });

  describe("priceComparison", () => {
    it("returns comparison data", async () => {
      const result = await controller.priceComparison("mg-1");
      expect(arbitrageService.getPriceComparison).toHaveBeenCalledWith("mg-1");
      expect(result).toEqual({ spread: 0.02 });
    });

    it("throws NotFoundException when comparison not found", async () => {
      arbitrageService.getPriceComparison.mockResolvedValue(null);
      await expect(controller.priceComparison("bad")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("arbitrageOpportunities", () => {
    it("passes parsed params to service", async () => {
      await controller.arbitrageOpportunities("5", "10");
      expect(arbitrageService.findOpportunities).toHaveBeenCalledWith({
        thresholdPct: 5,
        limit: 10,
      });
    });

    it("defaults optional params", async () => {
      await controller.arbitrageOpportunities();
      expect(arbitrageService.findOpportunities).toHaveBeenCalledWith({
        thresholdPct: undefined,
        limit: undefined,
      });
    });
  });
});
