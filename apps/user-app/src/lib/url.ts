const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function safeHref(url: string | null | undefined): string {
  return isSafeExternalUrl(url) ? (url as string) : '#';
}
