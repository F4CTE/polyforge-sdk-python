export type KnownVenueId = "polymarket" | "kalshi";

export type VenueId = KnownVenueId | (string & {});

export const VENUE_IDS: readonly string[] = ["polymarket", "kalshi"] as const;

export function isKnownVenue(id: string): id is KnownVenueId {
  return id === "polymarket" || id === "kalshi";
}
