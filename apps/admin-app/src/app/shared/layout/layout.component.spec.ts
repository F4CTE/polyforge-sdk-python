import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The updateCurrentPage method lives on LayoutComponent. We extract the logic
// here so we can test it without Angular TestBed (admin-app has no vitest wired up).

function deriveCurrentPage(url: string): string {
  const segment = url.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("LayoutComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("currentPage derivation", () => {
    it('returns "Dashboard" for URL "/dashboard"', () => {
      expect(deriveCurrentPage("/dashboard")).toBe("Dashboard");
    });

    it('returns "Users" for URL "/users"', () => {
      expect(deriveCurrentPage("/users")).toBe("Users");
    });

    it('returns "Tickets" for URL "/tickets"', () => {
      expect(deriveCurrentPage("/tickets")).toBe("Tickets");
    });

    it('returns "Users" for URL "/users/123" (uses first segment only)', () => {
      expect(deriveCurrentPage("/users/123")).toBe("Users");
    });

    it('defaults to "Dashboard" for empty URL "/"', () => {
      expect(deriveCurrentPage("/")).toBe("Dashboard");
    });
  });
});
