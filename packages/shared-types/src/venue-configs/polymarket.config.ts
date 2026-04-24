import { registerVenue } from "../venue-config";
import type { VenueConfig } from "../venue-config";

export const POLYMARKET_DEFAULTS: VenueConfig = {
  venueId: "polymarket",
  displayName: "Polymarket",
  restBaseUrl: "https://clob.polymarket.com",
  wsUrl: "wss://ws-subscriptions-clob.polymarket.com/ws/market",
  authType: "api_key",
  capabilities: {
    supportedCandleResolutions: ["1m", "5m", "15m", "1h", "1d"],
    supportsPositionTracking: true,
    supportsFractionalContracts: true,
    supportsSubpenny: true,
    supportedOrderTypes: ["GTC", "FOK", "GTD"],
    supportsOrderAmend: false,
    supportsBatchOrders: false,
    supportsRfq: false,
    supportsWebSocket: true,
    supportsUserWebSocket: true,
  },
  enabled: true,
};

registerVenue(POLYMARKET_DEFAULTS);
