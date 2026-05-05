import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl, safeHref } from '../lib/url';

describe('isSafeExternalUrl', () => {
  it('allows https URLs', () => {
    expect(isSafeExternalUrl('https://example.com/article')).toBe(true);
  });

  it('allows https URLs with surrounding whitespace', () => {
    expect(isSafeExternalUrl('  https://example.com/article  ')).toBe(true);
  });

  it('allows http URLs', () => {
    expect(isSafeExternalUrl('http://example.com/article')).toBe(true);
  });

  it('blocks javascript: protocol', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks javascript: protocol with surrounding whitespace', () => {
    expect(isSafeExternalUrl('  javascript:alert(1)  ')).toBe(false);
  });

  it('blocks javascript: protocol with embedded control characters', () => {
    expect(isSafeExternalUrl('java\nscript:alert(1)')).toBe(false);
  });

  it('blocks data: protocol', () => {
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('blocks vbscript: protocol', () => {
    expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSafeExternalUrl(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSafeExternalUrl(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSafeExternalUrl('')).toBe(false);
  });

  it('returns false for relative paths', () => {
    expect(isSafeExternalUrl('/relative/path')).toBe(false);
  });

  it('returns false for malformed URLs', () => {
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });
});

describe('safeHref', () => {
  it('returns the normalized URL when safe', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com/');
  });

  it('trims surrounding whitespace from safe URLs', () => {
    expect(safeHref('  https://example.com/article  ')).toBe('https://example.com/article');
  });

  it('returns # for javascript: protocol (XSS vector)', () => {
    expect(safeHref('javascript:alert(1)')).toBe('#');
  });

  it('returns # for null', () => {
    expect(safeHref(null)).toBe('#');
  });

  it('returns # for undefined', () => {
    expect(safeHref(undefined)).toBe('#');
  });
});
