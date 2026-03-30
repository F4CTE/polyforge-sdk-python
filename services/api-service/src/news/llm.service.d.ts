import { ConfigService } from "@nestjs/config";
export declare class LlmService {
    private readonly config;
    private readonly logger;
    private readonly claudeApiKey;
    private readonly openaiApiKey;
    constructor(config: ConfigService);
    /**
     * Analyze a prompt using LLM. Tries Claude first, falls back to GPT-4o.
     */
    analyze(prompt: string): Promise<string>;
    private callClaude;
    private callOpenAI;
}
//# sourceMappingURL=llm.service.d.ts.map