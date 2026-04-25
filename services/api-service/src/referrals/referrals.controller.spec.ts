import { describe, it, expect } from "vitest";
import { ReferralsController } from "./referrals.controller";

describe("ReferralsController", () => {
  const controller = new ReferralsController();
  const fakeUser = { sub: "user-abc-123", email: "test@example.com" };

  describe("getMyReferrals", () => {
    it("returns stats object with invited, signedUp, active, creditsEarned", () => {
      const result = controller.getMyReferrals(fakeUser as any);

      expect(result).toHaveProperty("stats");
      expect(result.stats).toEqual({
        invited: 0,
        signedUp: 0,
        active: 0,
        creditsEarned: 0,
      });
    });

    it("returns referralCode as a non-empty string", () => {
      const result = controller.getMyReferrals(fakeUser as any);

      expect(result.referralCode).toEqual(expect.any(String));
      expect(result.referralCode.length).toBeGreaterThan(0);
    });

    it("returns referralLink containing the referral code", () => {
      const result = controller.getMyReferrals(fakeUser as any);

      expect(result).toHaveProperty("referralLink");
      expect(result.referralLink).toContain(result.referralCode);
    });

    it("returns empty referrals array", () => {
      const result = controller.getMyReferrals(fakeUser as any);

      expect(result.referrals).toEqual([]);
    });

    it("does not return flat fields (userId, totalReferred, activeReferred, earnings)", () => {
      const result = controller.getMyReferrals(fakeUser as any);

      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("totalReferred");
      expect(result).not.toHaveProperty("activeReferred");
      expect(result).not.toHaveProperty("earnings");
    });
  });
});
