/**
 * Tests that action blocks propagate EvalContext.venue to generated OrderIntents.
 * Verifies that strategies configured for specific venues emit venue-tagged intents.
 */
import { describe, it, expect, vi } from "vitest";
import { BuyYesAction, BuyNoAction } from "./action.blocks";
import { block, makeCtx, makePrisma, makeRedis } from "./__helpers__";

const TOKEN = { id: "tok-yes", marketId: "mkt-1", outcome: "YES" };
const NO_TOKEN = { id: "tok-no", marketId: "mkt-1", outcome: "NO" };

describe("Action blocks — venue propagation", () => {
  describe("BuyYesAction", () => {
    it("emits intent with venue='polymarket' when ctx.venue is 'polymarket'", async () => {
      const prisma = makePrisma();
      prisma.token.findUnique.mockResolvedValue(TOKEN);
      const ctx = makeCtx({}, Date.now(), "polymarket");

      const { intents } = await BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        ctx,
        makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.6 }) }),
        prisma,
      );

      expect(intents[0].venue).toBe("polymarket");
    });

    it("emits intent with venue='kalshi' when ctx.venue is 'kalshi'", async () => {
      const prisma = makePrisma();
      prisma.token.findUnique.mockResolvedValue(TOKEN);
      const ctx = makeCtx({}, Date.now(), "kalshi");

      const { intents } = await BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        ctx,
        makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.44 }) }),
        prisma,
      );

      expect(intents[0].venue).toBe("kalshi");
    });

    it("emits intent with venue='best' when ctx.venue is 'best'", async () => {
      const prisma = makePrisma();
      prisma.token.findUnique.mockResolvedValue(TOKEN);
      const ctx = makeCtx({}, Date.now(), "best");

      const { intents } = await BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        ctx,
        makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.55 }) }),
        prisma,
      );

      expect(intents[0].venue).toBe("best");
    });

    it("emits intent without venue when ctx.venue is undefined (existing behavior unchanged)", async () => {
      const prisma = makePrisma();
      prisma.token.findUnique.mockResolvedValue(TOKEN);
      const ctx = makeCtx(); // no venue

      const { intents } = await BuyYesAction.execute(
        block("buy_yes", { tokenId: "tok-yes", size: "10" }),
        ctx,
        makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.6 }) }),
        prisma,
      );

      expect(intents[0].venue).toBeUndefined();
    });
  });

  describe("BuyNoAction", () => {
    it("propagates ctx.venue to the BUY NO intent", async () => {
      const prisma = makePrisma();
      // BuyNoAction: findUnique gets the YES token → extracts marketId; findFirst gets the NO token
      prisma.token.findUnique.mockResolvedValue(TOKEN);
      prisma.token.findFirst.mockResolvedValue(NO_TOKEN);
      const ctx = makeCtx({}, Date.now(), "kalshi");

      const { intents } = await BuyNoAction.execute(
        block("buy_no", { tokenId: "tok-yes", size: "10" }),
        ctx,
        makeRedis({ getJson: vi.fn().mockResolvedValue({ price: 0.44 }) }),
        prisma,
      );

      expect(intents[0].venue).toBe("kalshi");
    });
  });
});
