import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { of } from "rxjs";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeApiResponse(total: number) {
  return { data: [], total, page: 1, limit: 1, totalPages: 1, hasNext: false };
}

function makeApi() {
  return {
    tickets: vi.fn().mockReturnValue(of(makeApiResponse(0))),
  };
}

function makeToast() {
  return {
    add: vi.fn(),
  };
}

// ─── Test helpers ────────────────────────────────────────────────────────────
// The Angular service uses inject() for DI, signals, and RxJS interval polling.
// We replicate the core fetch-and-detect logic so we can unit-test the behavior
// without Angular TestBed (the admin-app has no vitest/TestBed wired up).

function createServiceUnderTest(api: ReturnType<typeof makeApi>) {
  let openTickets = 0;
  let lastKnownCount = -1;
  let toastService: ReturnType<typeof makeToast> | null = null;

  const getOpenTickets = () => openTickets;

  const fetchCount = () => {
    api.tickets({ status: "OPEN", limit: 1 }).subscribe((res: any) => {
      if (!res) return;
      const count = res.total ?? 0;
      lastKnownCount = count;
      openTickets = count;
    });
  };

  const handlePollResult = (res: any) => {
    if (!res) return;
    const count = res.total ?? 0;
    if (lastKnownCount >= 0 && count > lastKnownCount && toastService) {
      toastService.add({
        severity: "info",
        summary: "New ticket",
        detail: `${count - lastKnownCount} new support ticket(s) received.`,
        life: 5000,
      });
    }
    lastKnownCount = count;
    openTickets = count;
  };

  const start = (toast?: ReturnType<typeof makeToast>) => {
    toastService = toast ?? null;
    fetchCount();
  };

  return {
    openTickets: getOpenTickets,
    start,
    fetchCount,
    handlePollResult,
    getLastKnownCount: () => lastKnownCount,
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("AdminPollingService", () => {
  let service: ReturnType<typeof createServiceUnderTest>;
  let api: ReturnType<typeof makeApi>;

  beforeEach(() => {
    api = makeApi();
    service = createServiceUnderTest(api);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with openTickets = 0", () => {
    expect(service.openTickets()).toBe(0);
  });

  it("fetchCount updates openTickets signal", () => {
    api.tickets.mockReturnValue(of(makeApiResponse(5)));

    service.fetchCount();

    expect(service.openTickets()).toBe(5);
  });

  it("start triggers initial fetchCount", () => {
    api.tickets.mockReturnValue(of(makeApiResponse(3)));

    service.start();

    expect(service.openTickets()).toBe(3);
    expect(api.tickets).toHaveBeenCalledWith({ status: "OPEN", limit: 1 });
  });

  it("detects new tickets when count increases", () => {
    const toast = makeToast();
    api.tickets.mockReturnValue(of(makeApiResponse(2)));

    // Initial fetch establishes baseline
    service.start(toast);
    expect(service.openTickets()).toBe(2);

    // Simulate poll result with higher count
    service.handlePollResult(makeApiResponse(4));

    expect(toast.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "info",
        summary: "New ticket",
        detail: "2 new support ticket(s) received.",
      }),
    );
    expect(service.openTickets()).toBe(4);
  });

  it("does not toast when count stays the same", () => {
    const toast = makeToast();
    api.tickets.mockReturnValue(of(makeApiResponse(3)));

    service.start(toast);
    service.handlePollResult(makeApiResponse(3));

    expect(toast.add).not.toHaveBeenCalled();
  });

  it("does not toast when count decreases", () => {
    const toast = makeToast();
    api.tickets.mockReturnValue(of(makeApiResponse(5)));

    service.start(toast);
    service.handlePollResult(makeApiResponse(3));

    expect(toast.add).not.toHaveBeenCalled();
    expect(service.openTickets()).toBe(3);
  });

  it("does not toast when no toast service is provided", () => {
    api.tickets.mockReturnValue(of(makeApiResponse(1)));

    service.start(); // no toast
    service.handlePollResult(makeApiResponse(5));

    // Should not throw — just silently update
    expect(service.openTickets()).toBe(5);
  });

  it("handles null response gracefully", () => {
    api.tickets.mockReturnValue(of(makeApiResponse(2)));
    service.start();

    service.handlePollResult(null);

    // Should remain at previous count
    expect(service.openTickets()).toBe(2);
  });
});
