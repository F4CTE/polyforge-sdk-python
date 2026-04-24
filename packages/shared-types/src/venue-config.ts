import type { CandleResolution } from "./markets";

// ─── Venue Auth Context ──────────────────────────────────────────────────────

export interface KalshiAuthContext {
  venue: "kalshi";
  userId: string;
}

export interface PolymarketAuthContext {
  venue: "polymarket";
  apiKey: string;
  apiSecret: string;
  passphrase: string;
  funderAddress?: string;
}

export interface GenericAuthContext {
  venue: string;
  [key: string]: unknown;
}

export type VenueAuthContext =
  | KalshiAuthContext
  | PolymarketAuthContext
  | GenericAuthContext;

// ─── Venue Capabilities ──────────────────────────────────────────────────────

export type VenueOrderType = "GTC" | "FOK" | "GTD" | "FAK" | "POST_ONLY";

export interface VenueCapabilities {
  supportedCandleResolutions: CandleResolution[];
  supportsPositionTracking: boolean;
  supportsFractionalContracts: boolean;
  supportsSubpenny: boolean;
  supportedOrderTypes: VenueOrderType[];
  supportsOrderAmend: boolean;
  supportsBatchOrders: boolean;
  supportsRfq: boolean;
  supportsWebSocket: boolean;
  supportsUserWebSocket: boolean;
}

// ─── Venue Configuration ─────────────────────────────────────────────────────

export type VenueAuthType = "jwt" | "api_key" | "hmac" | "rsa_pss" | "none";

export interface VenueConfig {
  venueId: string;
  displayName: string;
  restBaseUrl: string;
  wsUrl: string;
  authType: VenueAuthType;
  capabilities: VenueCapabilities;
  enabled: boolean;
}

// ─── Venue Registry ──────────────────────────────────────────────────────────

const venueRegistry = new Map<string, VenueConfig>();

export function registerVenue(config: VenueConfig): void {
  if (venueRegistry.has(config.venueId)) {
    throw new Error(
      `Venue '${config.venueId}' is already registered. Each venue must be registered exactly once.`,
    );
  }
  venueRegistry.set(config.venueId, config);
}

export function getVenueConfig(venueId: string): VenueConfig | undefined {
  return venueRegistry.get(venueId);
}

export function getVenueConfigOrThrow(venueId: string): VenueConfig {
  const config = venueRegistry.get(venueId);
  if (!config) {
    throw new Error(
      `No configuration registered for venue '${venueId}'. ` +
        `Registered venues: ${getRegisteredVenueIds().join(", ") || "(none)"}`,
    );
  }
  return config;
}

export function getRegisteredVenueIds(): string[] {
  return Array.from(venueRegistry.keys());
}

export function getAllVenueConfigs(): VenueConfig[] {
  return Array.from(venueRegistry.values());
}

export function getEnabledVenueConfigs(): VenueConfig[] {
  return getAllVenueConfigs().filter((c) => c.enabled);
}

export function isRegisteredVenue(venueId: string): boolean {
  return venueRegistry.has(venueId);
}

export function clearVenueRegistry(): void {
  venueRegistry.clear();
}
