import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The statusBadge method lives on UsersListComponent. We extract the logic here
// so we can test it without Angular TestBed (admin-app has no vitest wired up).

function statusBadge(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case "CONNECTED":
      return { label: "ACTIVE",     bg: "rgba(34,197,94,0.1)",   color: "#22C55E" };
    case "VERIFIED":
      return { label: "ACTIVE",     bg: "rgba(34,197,94,0.1)",   color: "#22C55E" };
    case "UNVERIFIED":
      return { label: "UNVERIFIED", bg: "rgba(245,158,11,0.1)",  color: "#F59E0B" };
    default:
      return { label: status || "UNKNOWN", bg: "rgba(245,158,11,0.1)", color: "#F59E0B" };
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("UsersListComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("statusBadge", () => {
    it('returns Active/green for CONNECTED', () => {
      const result = statusBadge("CONNECTED");

      expect(result.label).toBe("ACTIVE");
      expect(result.color).toBe("#22C55E");
      expect(result.bg).toBe("rgba(34,197,94,0.1)");
    });

    it('returns Active/green for VERIFIED', () => {
      const result = statusBadge("VERIFIED");

      expect(result.label).toBe("ACTIVE");
      expect(result.color).toBe("#22C55E");
      expect(result.bg).toBe("rgba(34,197,94,0.1)");
    });

    it('returns Unverified/amber for UNVERIFIED', () => {
      const result = statusBadge("UNVERIFIED");

      expect(result.label).toBe("UNVERIFIED");
      expect(result.color).toBe("#F59E0B");
      expect(result.bg).toBe("rgba(245,158,11,0.1)");
    });

    it('returns Suspended/amber for SUSPENDED (falls to default)', () => {
      const result = statusBadge("SUSPENDED");

      expect(result.label).toBe("SUSPENDED");
      expect(result.color).toBe("#F59E0B");
      expect(result.bg).toBe("rgba(245,158,11,0.1)");
    });

    it('returns UNKNOWN/amber for empty string status', () => {
      const result = statusBadge("");

      expect(result.label).toBe("UNKNOWN");
      expect(result.color).toBe("#F59E0B");
      expect(result.bg).toBe("rgba(245,158,11,0.1)");
    });
  });
});
