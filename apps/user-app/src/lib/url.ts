const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

function parseSafeExternalUrl(url: string | null | undefined): URL | null {
  if (!url) return null;
  const candidate = url.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  return parseSafeExternalUrl(url) !== null;
}

export function safeHref(url: string | null | undefined): string {
  return parseSafeExternalUrl(url)?.href ?? '#';
}
