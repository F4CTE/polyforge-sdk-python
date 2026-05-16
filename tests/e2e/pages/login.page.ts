import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the Login page (/login).
 *
 * Updated for React + shadcn frontend (replaces Angular + PrimeNG).
 * Uses semantic selectors (id, type, role, text) where possible.
 */
export class LoginPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly totpInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.email = page.locator("#email");
    // React renders a plain <input type="password"> with id="password"
    this.password = page.locator("#password");
    this.submit = page.locator("button", { hasText: "Sign in" });
    // Error alert: a div with AlertCircle icon and error text (token migration: bg-pf-danger → bg-loss)
    this.error = page.locator('div[role="alert"].bg-loss\\/10');
    // TOTP input: plain <input id="totp"> shown conditionally
    this.totpInput = page.locator("#totp");
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await expect(
      this.page.locator("h1", { hasText: "Welcome back" }),
    ).toBeVisible({ timeout: 15_000 });
    // Dismiss cookie banner if present
    const cookieBtn = this.page.locator("button", { hasText: "Got it" });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    // The email input has autoFocus. Blurring it now pre-triggers the
    // "Email is required" validation layout shift so that any subsequent
    // link clicks are not disrupted by the card growing taller mid-click.
    await this.email.blur();
  }

  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /** Login and wait for navigation away from /login */
  async loginAndRedirect(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 30_000,
    });
  }

  async errorText(): Promise<string> {
    await expect(this.error).toBeVisible();
    return (await this.error.textContent()) ?? "";
  }

  /**
   * Submit a TOTP code during login and wait for the outcome.
   *
   * When the code is rejected (e.g. expired TOTP near a period boundary)
   * the error alert appears on /login instead of a redirect.  Throw
   * a TOTP-specific error so `verifyTotp` can retry with adjacent-window
   * codes instead of treating the timeout as a non-retryable failure.
   *
   * If neither the redirect nor an error alert occurs within the timeout
   * (e.g. the backend silently rejects an expired code without rendering
   * the error alert), the Playwright timeout is converted to a retryable
   * TOTP error so verifyTotp tries the adjacent-window codes.
   */
  async submitTotpAndRedirect(code: string, timeout = 15_000): Promise<void> {
    // Dismiss any stale error alert from a previous failed TOTP
    // attempt before submitting the new code.  The alert's dismiss
    // button clears React state (setError('')), removing the div
    // from the DOM.  Without this the error.waitFor({state:'visible'})
    // inside Promise.race resolves immediately with the old alert and
    // kills the retry before the new code reaches the backend.
    const dismiss = this.error.locator('button[aria-label="Dismiss error"]');
    if (await dismiss.isVisible({ timeout: 500 }).catch(() => false)) {
      await dismiss.click();
      await this.error.waitFor({ state: "hidden", timeout: 2000 });
    }
    // Hard guard: ensure the error alert is truly hidden before
    // submitting the new TOTP code.  If the dismiss button was not
    // visible or the hidden-wait did not resolve, the stale error
    // div could still be in the DOM.
    await expect(this.error)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // If the error is still visible, we proceed anyway — the
        // errorWasVisible check below prevents the Promise.race
        // error leg from resolving on pre-existing state.
      });
    // Track whether the error was visible BEFORE clicking submit.
    // The Promise.race error leg must never resolve from a stale,
    // pre-existing error element.
    const errorWasVisible = await this.error.isVisible().catch(() => false);
    await this.totpInput.clear();
    await this.totpInput.fill(code);
    await this.submit.click();
    try {
      await Promise.race([
        this.page.waitForURL((url) => !url.pathname.startsWith("/login"), {
          timeout,
        }),
        (async () => {
          if (!errorWasVisible) {
            await this.error.waitFor({ state: "visible", timeout });
          } else {
            await this.error.waitFor({ state: "hidden", timeout: 3000 });
            await this.error.waitFor({ state: "visible", timeout });
          }
          throw new Error("TOTP code invalid: login error alert appeared");
        })(),
      ]);
    } catch (e: unknown) {
      const msg = String((e as Error)?.message ?? e ?? "");
      if (
        /\b(?:timed?\s*out|timeout)\b/i.test(msg) &&
        this.page.url().includes("/login")
      ) {
        throw new Error(
          "TOTP code invalid (timed out on /login, likely expired TOTP)",
          { cause: e },
        );
      }
      throw e;
    }
  }

  /** Navigate to register page via the link */
  async clickCreateAccount(): Promise<void> {
    await this.page.locator("a", { hasText: "Create one" }).click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.page.locator("a", { hasText: "Forgot password?" }).click();
  }
}
