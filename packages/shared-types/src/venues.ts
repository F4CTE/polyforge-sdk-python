export type VenueId = "polymarket" | "kalshi";

export const VENUE_IDS = [
  "polymarket",
  "kalshi",
] as const satisfies readonly VenueId[];
