export type KnownVenueId = "polymarket" | "kalshi" | "polymarket_us";

export type VenueId = KnownVenueId | (string & {});

export const VENUE_IDS: readonly string[] = [
  "polymarket",
  "kalshi",
  "polymarket_us",
] as const;

export function isKnownVenue(id: string): id is KnownVenueId {
  return id === "polymarket" || id === "kalshi" || id === "polymarket_us";
}
