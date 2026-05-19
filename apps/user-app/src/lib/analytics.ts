/// <reference types="vite/client" />
import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';
const SENSITIVE_QUERY_PARAMS = new Set(['token', 'code', 'reset_token', 'verification_token']);

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    let changed = false;
    for (const key of SENSITIVE_QUERY_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[REDACTED]');
        changed = true;
      }
    }
    return changed ? url.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

export function initAnalytics(): void {
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-sensitive]',
    },
    mask_all_text: true,
    mask_all_element_attributes: true,
    loaded: (ph) => {
      ph.register_once({ $initial_referrer: document.referrer });
    },
    sanitize_properties: (properties) => {
      for (const key of Object.keys(properties)) {
        const val = properties[key];
        if (typeof val === 'string' && val.startsWith('http')) {
          const redacted = redactUrl(val);
          if (redacted !== val) properties[key] = redacted;
        }
      }
      return properties;
    },
  });
}

export function identifyUser(userId: string, props: { email: string; username: string }): void {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, props);
}

export function resetAnalytics(): void {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
