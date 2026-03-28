import { IsString, Matches } from "class-validator";

/**
 * DTO for validating cache flush pattern requests.
 * Only allows whitelisted cache key patterns to prevent accidental full cache wipes.
 */
export class FlushCacheDto {
  @IsString()
  @Matches(/^(cache:(price|book|market|notif-prefs)|user|portfolio|markets):\*?$/, {
    message:
      "Pattern must be one of: cache:price:*, cache:book:*, cache:market:*, cache:notif-prefs:*, user:*, portfolio:*, or markets:*",
  })
  pattern: string;

  /**
   * Whitelisted patterns that are safe to flush.
   * Prevents dangerous patterns like '*' or 'cache:*' that could wipe everything.
   */
  static readonly ALLOWED_PATTERNS = [
    "cache:price:*",
    "cache:book:*",
    "cache:market:*",
    "cache:notif-prefs:*",
    "user:*",
    "portfolio:*",
    "markets:*",
  ];

  /**
   * Validates if a pattern is in the whitelist.
   */
  static isAllowed(pattern: string): boolean {
    return this.ALLOWED_PATTERNS.includes(pattern);
  }
}
