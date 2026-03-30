import { ActionsService } from "./actions.service";
/**
 * Public endpoint — no auth required.
 * Returns a structured list of all available API actions so AI agents can
 * discover capabilities programmatically.
 */
export declare class ActionsController {
    private readonly actionsService;
    constructor(actionsService: ActionsService);
    getActions(): import("./actions.service").ActionsSchema;
}
//# sourceMappingURL=actions.controller.d.ts.map