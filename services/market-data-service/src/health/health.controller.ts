import { Controller, Get } from "@nestjs/common";
import { PolymarketWsService } from "../market-sync/polymarket-ws.service";

@Controller("health")
export class HealthController {
  constructor(private readonly ws: PolymarketWsService) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "market-data-service",
      websocket: this.ws.isConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}
