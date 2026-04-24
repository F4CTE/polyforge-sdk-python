import { registerVenue } from "../venue-config";
import type { VenueConfig } from "../venue-config";

export const KALSHI_DEFAULTS: VenueConfig = {
  venueId: "kalshi",
  displayName: "Kalshi",
  restBaseUrl: "https://demo-api.kalshi.co/trade-api/v2",
  wsUrl: "wss://demo-api.kalshi.co/trade-api/ws/v2",
  authType: "rsa_pss",
  capabilities: {
    supportedCandleResolutions: ["1m", "1h", "1d"],
    supportsPositionTracking: true,
    supportsFractionalContracts: false,
    supportsSubpenny: false,
    supportedOrderTypes: ["GTC", "FOK", "GTD"],
    supportsOrderAmend: true,
    supportsBatchOrders: true,
    supportsRfq: true,
    supportsWebSocket: true,
    supportsUserWebSocket: true,
  },
  enabled: false,
};

registerVenue(KALSHI_DEFAULTS);
