import { registerVenue } from "../venue-config";
import type { VenueConfig } from "../venue-config";

export const POLYMARKET_US_DEFAULTS: VenueConfig = {
  venueId: "polymarket_us",
  displayName: "Polymarket US",
  restBaseUrl: "https://api.polymarket.us",
  wsUrl: "wss://ws.polymarket.us",
  authType: "ed25519",
  capabilities: {
    supportedCandleResolutions: ["1m", "5m", "15m", "1h", "1d"],
    supportsPositionTracking: true,
    supportsFractionalContracts: true,
    supportsSubpenny: true,
    supportedOrderTypes: ["GTC", "FOK"],
    supportsOrderAmend: false,
    supportsBatchOrders: false,
    supportsRfq: false,
    supportsWebSocket: true,
    supportsUserWebSocket: false,
  },
  enabled: false,
};

registerVenue(POLYMARKET_US_DEFAULTS);
