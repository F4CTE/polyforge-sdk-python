"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LlmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let LlmService = LlmService_1 = class LlmService {
    config;
    logger = new common_1.Logger(LlmService_1.name);
    claudeApiKey;
    openaiApiKey;
    constructor(config) {
        this.config = config;
        this.claudeApiKey = this.config.get("ANTHROPIC_API_KEY", "");
        this.openaiApiKey = this.config.get("OPENAI_API_KEY", "");
        // M-04: Validate at startup that at least one API key is configured
        if (!this.claudeApiKey && !this.openaiApiKey) {
            this.logger.warn("No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-powered features.");
        }
    }
    /**
     * Analyze a prompt using LLM. Tries Claude first, falls back to GPT-4o.
     */
    async analyze(prompt) {
        if (this.claudeApiKey) {
            try {
                return await this.callClaude(prompt);
            }
            catch (err) {
                this.logger.warn(`Claude API call failed, falling back to OpenAI: ${err?.message}`);
            }
        }
        if (this.openaiApiKey) {
            try {
                return await this.callOpenAI(prompt);
            }
            catch (err) {
                this.logger.error(`OpenAI API call also failed: ${err?.message}`);
                throw new Error("All LLM providers failed");
            }
        }
        throw new Error("No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");
    }
    async callClaude(prompt) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": this.claudeApiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                messages: [{ role: "user", content: prompt }],
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Claude API error ${res.status}: ${text}`);
        }
        const data = (await res.json());
        return data.content[0].text;
    }
    async callOpenAI(prompt) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.openaiApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1024,
            }),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`OpenAI API error ${res.status}: ${text}`);
        }
        const data = (await res.json());
        return data.choices[0].message.content;
    }
};
exports.LlmService = LlmService;
exports.LlmService = LlmService = LlmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LlmService);
//# sourceMappingURL=llm.service.js.map