import { Controller, Get } from "@nestjs/common";
import { StrategyRegistryService } from "../strategy/strategy-registry.service";

@Controller("health")
export class HealthController {
  constructor(private readonly registry: StrategyRegistryService) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "strategy-engine",
      timestamp: new Date().toISOString(),
    };
  }
}
