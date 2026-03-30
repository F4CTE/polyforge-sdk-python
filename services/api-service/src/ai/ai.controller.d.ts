import { AiService } from "./ai.service";
import { AiQueryDto } from "./dto/ai-query.dto";
export declare class AiController {
    private readonly ai;
    constructor(ai: AiService);
    query(user: any, dto: AiQueryDto): Promise<import("./ai.service").QueryResult>;
}
//# sourceMappingURL=ai.controller.d.ts.map