import { describe, it, expect, beforeEach } from 'vitest';
import { BETA_DISMISSED_KEY } from './beta-banner';

/**
 * Unit tests for the beta banner dismissal logic.
 *
 * These tests verify the pure persistence behaviour (localStorage key,
 * dismissed state) without rendering React components.
 */

// ─── Helpers mirrored from the component ─────────────────────────────────────

function shouldShowBanner(): boolean {
  return !localStorage.getItem(BETA_DISMISSED_KEY);
}

function dismissBanner(): void {
  localStorage.setItem(BETA_DISMISSED_KEY, '1');
}

function resetBanner(): void {
  localStorage.removeItem(BETA_DISMISSED_KEY);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BetaBanner dismissal logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the banner when no dismissal key is present', () => {
    expect(shouldShowBanner()).toBe(true);
  });

  it('hides the banner when dismissal key is set', () => {
    dismissBanner();
    expect(shouldShowBanner()).toBe(false);
  });

  it('dismissBanner writes the correct localStorage key', () => {
    dismissBanner();
    expect(localStorage.getItem(BETA_DISMISSED_KEY)).toBe('1');
  });

  it('resetBanner removes the dismissal key', () => {
    dismissBanner();
    resetBanner();
    expect(localStorage.getItem(BETA_DISMISSED_KEY)).toBeNull();
  });

  it('shows banner again after reset', () => {
    dismissBanner();
    resetBanner();
    expect(shouldShowBanner()).toBe(true);
  });

  it('BETA_DISMISSED_KEY is a stable string constant', () => {
    expect(typeof BETA_DISMISSED_KEY).toBe('string');
    expect(BETA_DISMISSED_KEY).toBe('pf-beta-dismissed');
  });
});
