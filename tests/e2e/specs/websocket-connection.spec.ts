import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import {
  apiRegisterAndVerify,
  uniqueEmail,
  uniqueUsername,
} from "../helpers/api";
import { clearAllMessages } from "../helpers/mailhog";

/**
 * WebSocket connection and status indicator e2e tests.
 *
 * Verifies the WebSocket connection UI surfaces render correctly and
 * respond to connection state changes:
 *   - Connection status dot on notification bell (color-coded by state)
 *   - SR-only connection state label
 *   - WebSocket disconnect banner component
 *   - Stale-data connection badge
 *   - Page resilience regardless of WS connection state
 *
 * These tests simulate WS connection state transitions via the global
 * wsManager singleton exposed at window.__wsManager during dev/test.
 * The hook MUST be exposed in localhost/CI E2E environments (app.tsx
 * gates on import.meta.env.DEV || window.location.hostname === "localhost").
 * A missing hook is a wiring regression — tests hard-fail instead of
 * silently skipping to prevent false-green runs.
 */

const DOT_SELECTOR = '[aria-label="Notifications"] .w-2.h-2.rounded-full';
const BANNER_SELECTOR = '[data-testid="websocket-disconnect-banner"]';

function hasWsManager(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return (
      typeof w.__wsManager !== "undefined" &&
      w.__wsManager !== null &&
      typeof (w.__wsManager as Record<string, unknown>)
        .__testFireConnectionState === "function"
    );
  });
}

function notifyWsListeners(
  page: import("@playwright/test").Page,
  state: string,
): Promise<void> {
  return page.evaluate((s) => {
    const w = window as unknown as Record<string, unknown>;
    const mgr = w.__wsManager as Record<string, unknown>;
    if (typeof mgr.__testFireConnectionState === "function") {
      (mgr.__testFireConnectionState as (s: string) => void)(s);
    }
  }, state);
}

/** Polls until the dot element's class attribute contains the expected bg-* token. */
async function waitForDotColorClass(
  page: import("@playwright/test").Page,
  expectedClass: string,
  timeout = 10_000,
): Promise<void> {
  await page.waitForFunction(
    ({ sel, cls }) => {
      const el = document.querySelector(sel);
      return el && el.className.includes(cls);
    },
    { sel: DOT_SELECTOR, cls: expectedClass },
    { timeout, polling: "raf" },
  );
}

test.describe("WebSocket — Connection State UI", () => {
  test.beforeAll(async () => {
    await clearAllMessages();
  });

  test.beforeEach(async ({ page }) => {
    const email = uniqueEmail("ws-e2e");
    const username = uniqueUsername("ws-e2e");
    await apiRegisterAndVerify(email, username, "Password123!");

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndRedirect(email, "Password123!");
  });

  test("notification bell renders with connection state indicator dot", async ({
    page,
  }) => {
    const notifButton = page.locator('button[aria-label="Notifications"]');
    await expect(notifButton).toBeVisible({ timeout: 10_000 });

    // Dot must be rendered — it is a core UI element for WS state feedback.
    const connDot = notifButton.locator(".w-2.h-2.rounded-full");
    await expect(connDot).toBeVisible({ timeout: 5_000 });

    // Dot should have a bg-* color class (gain=connected, warning=reconnecting, loss=disconnected).
    const classes = (await connDot.getAttribute("class")) ?? "";
    expect(classes).toMatch(/bg-(gain|warning|loss|muted)/);

    // SR-only label announces connection state to screen readers.
    const srLabel = notifButton.locator(".sr-only");
    const labelText = await srLabel.textContent().catch(() => "");
    expect(labelText).toMatch(/live updates/i);
  });

  test("connection dot color changes reflect WebSocket state", async ({
    page,
  }) => {
    await page.goto("/markets");
    await expect(page.locator('[aria-label="Notifications"]')).toBeVisible({
      timeout: 10_000,
    });

    expect(
      await hasWsManager(page),
      "window.__wsManager must be exposed in localhost/CI — check app.tsx DEV gate",
    ).toBe(true);

    // Simulate connected state → dot should have bg-gain (green).
    await notifyWsListeners(page, "connected");
    await waitForDotColorClass(page, "bg-gain");

    const dotAfterConnect = page.locator(DOT_SELECTOR);
    const classesConnected =
      (await dotAfterConnect.getAttribute("class")) ?? "";
    expect(classesConnected).toContain("bg-gain");

    // Simulate disconnected state → dot should have bg-loss (red).
    await notifyWsListeners(page, "disconnected");
    await waitForDotColorClass(page, "bg-loss");

    const dotAfterDisconnect = page.locator(DOT_SELECTOR);
    const classesDisconnected =
      (await dotAfterDisconnect.getAttribute("class")) ?? "";
    expect(classesDisconnected).toContain("bg-loss");
  });

  test("WebSocket disconnect banner renders with correct accessible structure", async ({
    page,
  }) => {
    expect(
      await hasWsManager(page),
      "window.__wsManager must be exposed in localhost/CI — check app.tsx DEV gate",
    ).toBe(true);

    // Force reconnecting state — banner should become visible.
    await notifyWsListeners(page, "reconnecting");

    const banner = page.locator(BANNER_SELECTOR);
    await banner.waitFor({ state: "visible", timeout: 10_000 });

    // Should have role="status" and aria-live="polite".
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");

    // Should contain "Connection" or "reconnecting" text.
    const text = await banner.textContent();
    expect(text?.toLowerCase()).toMatch(/connection|reconnecting/);
  });

  test("stale-data connection badge renders when WebSocket is not connected", async ({
    page,
  }) => {
    expect(
      await hasWsManager(page),
      "window.__wsManager must be exposed in localhost/CI — check app.tsx DEV gate",
    ).toBe(true);

    // Force reconnecting state to make the stale-data badge visible.
    await notifyWsListeners(page, "reconnecting");

    const staleBadge = page.locator('div[role="status"]').filter({
      hasText: /reconnecting|disconnected|stale|may be stale/i,
    });
    await staleBadge.first().waitFor({ state: "visible", timeout: 10_000 });

    // Badge must have accessible status role.
    await expect(staleBadge.first()).toHaveAttribute("role", "status");
  });

  test("authenticated pages load regardless of WebSocket connection state", async ({
    page,
  }) => {
    // Collect page errors across both navigations.
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Navigate to a page that subscribes to WS events (markets list).
    await page.goto("/markets");
    await expect(page.locator("h1", { hasText: "Markets" })).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to another WS-subscribing page (portfolio).
    await page.goto("/portfolio");
    await expect(page.locator("h1", { hasText: /portfolio/i })).toBeVisible({
      timeout: 15_000,
    });

    // No page errors should have been emitted during either navigation.
    expect(errors).toHaveLength(0);
  });
});
