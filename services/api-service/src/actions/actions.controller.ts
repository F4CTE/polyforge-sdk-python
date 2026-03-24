import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ActionsService } from "./actions.service";

/**
 * Public endpoint — no auth required.
 * Returns a structured list of all available API actions so AI agents can
 * discover capabilities programmatically.
 */
@ApiTags("actions")
@Controller("actions")
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  getActions() {
    return this.actionsService.getActions();
  }
}
