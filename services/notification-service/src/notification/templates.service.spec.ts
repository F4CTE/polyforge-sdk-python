import { describe, it, expect, beforeEach } from "vitest";
import { TemplatesService } from "./templates.service";

describe("TemplatesService", () => {
  let service: TemplatesService;

  beforeEach(() => {
    service = new TemplatesService();
  });

  // ─── build() ───────────────────────────────────────────────────────────────

  describe("build", () => {
    describe("ORDER_FILLED", () => {
      it("returns correct title and success severity", () => {
        const result = service.build("ORDER_FILLED", {
          tokenId: "tok-abc",
          fillPrice: "0.72",
        });
        expect(result.title).toBe("Order Filled");
        expect(result.severity).toBe("success");
      });

      it("includes tokenId and fillPrice in body", () => {
        const result = service.build("ORDER_FILLED", {
          tokenId: "tok-abc",
          fillPrice: "0.72",
        });
        expect(result.body).toContain("tok-abc");
        expect(result.body).toContain("0.72");
      });

      it("falls back to price when fillPrice absent", () => {
        const result = service.build("ORDER_FILLED", {
          tokenId: "tok-abc",
          price: "0.55",
        });
        expect(result.body).toContain("0.55");
      });

      it("includes P&L in body when pnl is provided", () => {
        const result = service.build("ORDER_FILLED", {
          tokenId: "tok-abc",
          fillPrice: "0.80",
          pnl: "12.50",
        });
        expect(result.body).toContain("12.50 USDC");
      });

      it("omits P&L segment when pnl is absent", () => {
        const result = service.build("ORDER_FILLED", {
          tokenId: "tok-abc",
          fillPrice: "0.80",
        });
        expect(result.body).not.toContain("P&L");
      });

      it('uses "unknown" when tokenId is absent', () => {
        const result = service.build("ORDER_FILLED", {});
        expect(result.body).toContain("unknown");
      });
    });

    describe("STRATEGY_ERROR", () => {
      it("returns correct title and error severity", () => {
        const result = service.build("STRATEGY_ERROR", {
          strategyId: "strat-1",
          reason: "out of funds",
        });
        expect(result.title).toBe("Strategy Error");
        expect(result.severity).toBe("error");
      });

      it("includes strategyId and reason in body", () => {
        const result = service.build("STRATEGY_ERROR", {
          strategyId: "strat-1",
          reason: "out of funds",
        });
        expect(result.body).toContain("strat-1");
        expect(result.body).toContain("out of funds");
      });

      it('falls back to "unknown" when data fields absent', () => {
        const result = service.build("STRATEGY_ERROR", {});
        expect(result.body).toContain("unknown");
      });
    });

    describe("BACKTEST_COMPLETE", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("BACKTEST_COMPLETE", { runId: "run-99" });
        expect(result.title).toBe("Backtest Complete");
        expect(result.severity).toBe("info");
      });

      it("includes runId in body", () => {
        const result = service.build("BACKTEST_COMPLETE", { runId: "run-99" });
        expect(result.body).toContain("run-99");
      });

      it("includes totalPnl when provided", () => {
        const result = service.build("BACKTEST_COMPLETE", {
          runId: "run-99",
          totalPnl: "250.00",
        });
        expect(result.body).toContain("250.00 USDC");
      });

      it("omits totalPnl segment when absent", () => {
        const result = service.build("BACKTEST_COMPLETE", { runId: "run-99" });
        expect(result.body).not.toContain("Total P&L");
      });
    });

    describe("PRICE_ALERT", () => {
      it("returns correct title and warning severity", () => {
        const result = service.build("PRICE_ALERT", {
          tokenId: "tok-xyz",
          threshold: "0.90",
        });
        expect(result.title).toBe("Price Alert Triggered");
        expect(result.severity).toBe("warning");
      });

      it("includes tokenId and threshold in body", () => {
        const result = service.build("PRICE_ALERT", {
          tokenId: "tok-xyz",
          threshold: "0.90",
        });
        expect(result.body).toContain("tok-xyz");
        expect(result.body).toContain("0.90");
      });

      it("falls back to price when threshold absent", () => {
        const result = service.build("PRICE_ALERT", {
          tokenId: "tok-xyz",
          price: "0.85",
        });
        expect(result.body).toContain("0.85");
      });
    });

    describe("DAILY_LOSS_LIMIT", () => {
      it("returns correct title and error severity", () => {
        const result = service.build("DAILY_LOSS_LIMIT", {
          strategyId: "strat-5",
        });
        expect(result.title).toBe("Daily Loss Limit Reached");
        expect(result.severity).toBe("error");
      });

      it("includes strategyId in body", () => {
        const result = service.build("DAILY_LOSS_LIMIT", {
          strategyId: "strat-5",
        });
        expect(result.body).toContain("strat-5");
      });
    });

    describe("MARKET_RESOLVED", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("MARKET_RESOLVED", {
          marketId: "mkt-1",
          outcome: "YES",
        });
        expect(result.title).toBe("Market Resolved");
        expect(result.severity).toBe("info");
      });

      it("includes marketId and outcome in body", () => {
        const result = service.build("MARKET_RESOLVED", {
          marketId: "mkt-1",
          outcome: "YES",
        });
        expect(result.body).toContain("mkt-1");
        expect(result.body).toContain("YES");
      });
    });

    describe("SOMEONE_FORKED", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("SOMEONE_FORKED", {
          forkerUsername: "alice",
          strategyName: "My Strategy",
        });
        expect(result.title).toBe("Strategy Forked");
        expect(result.severity).toBe("info");
      });

      it("includes forkerUsername and strategyName in body", () => {
        const result = service.build("SOMEONE_FORKED", {
          forkerUsername: "alice",
          strategyName: "My Strategy",
        });
        expect(result.body).toContain("alice");
        expect(result.body).toContain("My Strategy");
      });

      it("falls back to strategyId when strategyName absent", () => {
        const result = service.build("SOMEONE_FORKED", {
          forkerUsername: "alice",
          strategyId: "strat-7",
        });
        expect(result.body).toContain("strat-7");
      });

      it('uses "Someone" when forkerUsername absent', () => {
        const result = service.build("SOMEONE_FORKED", {
          strategyName: "My Strategy",
        });
        expect(result.body).toContain("Someone");
      });
    });

    describe("SOMEONE_FOLLOWED", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("SOMEONE_FOLLOWED", {
          followerUsername: "bob",
        });
        expect(result.title).toBe("New Follower");
        expect(result.severity).toBe("info");
      });

      it("includes followerUsername in body", () => {
        const result = service.build("SOMEONE_FOLLOWED", {
          followerUsername: "bob",
        });
        expect(result.body).toContain("bob");
      });

      it('uses "Someone" when followerUsername absent', () => {
        const result = service.build("SOMEONE_FOLLOWED", {});
        expect(result.body).toContain("Someone");
      });
    });

    describe("SOMEONE_LIKED", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("SOMEONE_LIKED", {
          likerUsername: "carol",
          strategyName: "Alpha Strat",
        });
        expect(result.title).toBe("Strategy Liked");
        expect(result.severity).toBe("info");
      });

      it("includes likerUsername and strategyName in body", () => {
        const result = service.build("SOMEONE_LIKED", {
          likerUsername: "carol",
          strategyName: "Alpha Strat",
        });
        expect(result.body).toContain("carol");
        expect(result.body).toContain("Alpha Strat");
      });

      it('uses "Someone" when likerUsername absent', () => {
        const result = service.build("SOMEONE_LIKED", {
          strategyName: "Alpha Strat",
        });
        expect(result.body).toContain("Someone");
      });
    });

    describe("SOMEONE_COMMENTED", () => {
      it("returns correct title and info severity", () => {
        const result = service.build("SOMEONE_COMMENTED", {
          commenterUsername: "dave",
          strategyName: "Beta Strat",
        });
        expect(result.title).toBe("New Comment");
        expect(result.severity).toBe("info");
      });

      it("includes commenterUsername and strategyName in body", () => {
        const result = service.build("SOMEONE_COMMENTED", {
          commenterUsername: "dave",
          strategyName: "Beta Strat",
        });
        expect(result.body).toContain("dave");
        expect(result.body).toContain("Beta Strat");
      });

      it('uses "Someone" when commenterUsername absent', () => {
        const result = service.build("SOMEONE_COMMENTED", {
          strategyName: "Beta Strat",
        });
        expect(result.body).toContain("Someone");
      });
    });

    describe("unknown eventType (default branch)", () => {
      it("returns generic title and info severity", () => {
        const result = service.build("SOME_UNKNOWN_EVENT", {});
        expect(result.title).toBe("Polyforge Notification");
        expect(result.severity).toBe("info");
      });

      it("includes the raw eventType in the body", () => {
        const result = service.build("SOME_UNKNOWN_EVENT", {});
        expect(result.body).toContain("SOME_UNKNOWN_EVENT");
      });
    });
  });

  // ─── toHtml() ──────────────────────────────────────────────────────────────

  describe("toHtml", () => {
    it("returns a string containing the title", () => {
      const html = service.toHtml({
        title: "Test Title",
        body: "Test body.",
        severity: "info",
      });
      expect(html).toContain("Test Title");
    });

    it("returns a string containing the body text", () => {
      const html = service.toHtml({
        title: "T",
        body: "Important message here.",
        severity: "warning",
      });
      expect(html).toContain("Important message here.");
    });

    it("includes the Polyforge brand name", () => {
      const html = service.toHtml({
        title: "T",
        body: "B",
        severity: "success",
      });
      expect(html).toContain("Polyforge");
    });

    it("contains valid DOCTYPE declaration", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "error" });
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("uses the success accent colour (#22c55e) for success severity", () => {
      const html = service.toHtml({
        title: "T",
        body: "B",
        severity: "success",
      });
      expect(html).toContain("#22c55e");
    });

    it("uses the warning accent colour (#f59e0b) for warning severity", () => {
      const html = service.toHtml({
        title: "T",
        body: "B",
        severity: "warning",
      });
      expect(html).toContain("#f59e0b");
    });

    it("uses the error accent colour (#ef4444) for error severity", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "error" });
      expect(html).toContain("#ef4444");
    });

    it("uses the info accent colour (#3b82f6) for info severity", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "info" });
      expect(html).toContain("#3b82f6");
    });

    it("contains the severity label in the badge", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "error" });
      expect(html).toContain("Alert");
    });

    it("contains a link to manage preferences", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "info" });
      expect(html).toContain("/settings");
    });

    it("contains an Open Polyforge CTA link", () => {
      const html = service.toHtml({ title: "T", body: "B", severity: "info" });
      expect(html).toContain("Open Polyforge");
    });
  });
});
