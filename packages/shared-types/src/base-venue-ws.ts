// ─── Configuration ───────────────────────────────────────────────────────────

export interface VenueWsConfig {
  venueId: string;
  url: string;
  enabled: boolean;
  pingIntervalMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  reconnectFactor?: number;
  headers?: Record<string, string>;
}

export const MAX_VENUE_WS_FRAME_BYTES = 1 * 1024 * 1024;
