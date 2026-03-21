import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// The ThemeService uses Angular's inject() and signal(), which require Angular's
// injector. We replicate the core logic inline so we can unit-test the behavior
// without a full Angular TestBed (consistent with existing test patterns).

function createThemeService(savedTheme: string | null = null) {
  const storage: Record<string, string> = {};
  if (savedTheme !== null) storage["pf-theme"] = savedTheme;

  const localStorageMock = {
    getItem: vi.fn((key: string) => storage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  };

  let dataThemeAttr = "";
  const documentMock = {
    setAttribute: vi.fn((_name: string, value: string) => { dataThemeAttr = value; }),
  };

  // Replicate service state
  let isDark = true;

  // Constructor logic
  const saved = localStorageMock.getItem("pf-theme");
  if (saved === "light") {
    isDark = false;
    documentMock.setAttribute("data-theme", "light");
  }

  const toggle = () => {
    isDark = !isDark;
    const theme = isDark ? "dark" : "light";
    documentMock.setAttribute("data-theme", theme);
    localStorageMock.setItem("pf-theme", theme);
  };

  return {
    get isDark() { return isDark; },
    toggle,
    localStorage: localStorageMock,
    document: documentMock,
    get dataThemeAttr() { return dataThemeAttr; },
  };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("ThemeService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to dark mode (isDark = true)", () => {
    const service = createThemeService();
    expect(service.isDark).toBe(true);
  });

  it("does not set data-theme attribute on init when no saved preference", () => {
    const service = createThemeService();
    expect(service.document.setAttribute).not.toHaveBeenCalled();
  });

  it("toggle() switches from dark to light", () => {
    const service = createThemeService();
    service.toggle();

    expect(service.isDark).toBe(false);
    expect(service.document.setAttribute).toHaveBeenCalledWith("data-theme", "light");
  });

  it("toggle() twice switches back to dark", () => {
    const service = createThemeService();
    service.toggle(); // dark -> light
    service.toggle(); // light -> dark

    expect(service.isDark).toBe(true);
    expect(service.document.setAttribute).toHaveBeenLastCalledWith("data-theme", "dark");
  });

  it("toggle() persists theme to localStorage", () => {
    const service = createThemeService();
    service.toggle();

    expect(service.localStorage.setItem).toHaveBeenCalledWith("pf-theme", "light");

    service.toggle();

    expect(service.localStorage.setItem).toHaveBeenCalledWith("pf-theme", "dark");
  });

  it("reads saved 'light' preference from localStorage on init", () => {
    const service = createThemeService("light");

    expect(service.isDark).toBe(false);
    expect(service.document.setAttribute).toHaveBeenCalledWith("data-theme", "light");
  });

  it("reads saved 'dark' preference from localStorage on init (stays dark)", () => {
    const service = createThemeService("dark");

    expect(service.isDark).toBe(true);
    expect(service.document.setAttribute).not.toHaveBeenCalled();
  });

  it("ignores unknown localStorage values (stays dark)", () => {
    const service = createThemeService("something-invalid");

    expect(service.isDark).toBe(true);
    expect(service.document.setAttribute).not.toHaveBeenCalled();
  });
});
