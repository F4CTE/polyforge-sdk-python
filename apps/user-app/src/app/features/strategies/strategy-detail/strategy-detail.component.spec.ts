import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The error-handling logic lives in StrategyDetailComponent's ngOnInit error
// callback. We extract the logic here so we can test without Angular TestBed
// (user-app has no vitest wired up).

function handleLoadError(err: any): { notFound: boolean; loadError: string | null } {
  if (err?.status === 404) {
    return { notFound: true, loadError: null };
  } else if (err?.status === 403) {
    return { notFound: false, loadError: 'You do not have permission to view this strategy.' };
  } else {
    return { notFound: false, loadError: 'Failed to load strategy. Please try again.' };
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("StrategyDetailComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("error handling", () => {
    it("404 error sets notFound to true", () => {
      const result = handleLoadError({ status: 404 });

      expect(result.notFound).toBe(true);
      expect(result.loadError).toBeNull();
    });

    it("403 error sets loadError to 'forbidden' message", () => {
      const result = handleLoadError({ status: 403 });

      expect(result.notFound).toBe(false);
      expect(result.loadError).toBe('You do not have permission to view this strategy.');
    });

    it("500 error sets loadError to generic message", () => {
      const result = handleLoadError({ status: 500 });

      expect(result.notFound).toBe(false);
      expect(result.loadError).toBe('Failed to load strategy. Please try again.');
    });

    it("unknown error sets loadError to generic message", () => {
      const result = handleLoadError({});

      expect(result.notFound).toBe(false);
      expect(result.loadError).toBe('Failed to load strategy. Please try again.');
    });

    it("null error sets loadError to generic message", () => {
      const result = handleLoadError(null);

      expect(result.notFound).toBe(false);
      expect(result.loadError).toBe('Failed to load strategy. Please try again.');
    });
  });
});
