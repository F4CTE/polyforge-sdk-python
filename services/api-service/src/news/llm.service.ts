import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly claudeApiKey: string;
  private readonly openaiApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.claudeApiKey = this.config.get<string>("ANTHROPIC_API_KEY", "");
    this.openaiApiKey = this.config.get<string>("OPENAI_API_KEY", "");

    // M-04: Validate at startup that at least one API key is configured
    if (!this.claudeApiKey && !this.openaiApiKey) {
      this.logger.warn(
        "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-powered features.",
      );
    }
  }

  /**
   * Analyze a prompt using LLM. Tries Claude first, falls back to GPT-4o.
   */
  async analyze(prompt: string): Promise<string> {
    if (this.claudeApiKey) {
      try {
        return await this.callClaude(prompt);
      } catch (err: any) {
        this.logger.warn(
          `Claude API call failed, falling back to OpenAI: ${err?.message}`,
        );
      }
    }

    if (this.openaiApiKey) {
      try {
        return await this.callOpenAI(prompt);
      } catch (err: any) {
        this.logger.error(`OpenAI API call also failed: ${err?.message}`);
        throw new Error("All LLM providers failed");
      }
    }

    throw new Error(
      "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    );
  }

  private async callClaude(prompt: string): Promise<string> {
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

    const data = await res.json();
    return data.content[0].text;
  }

  private async callOpenAI(prompt: string): Promise<string> {
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

    const data = await res.json();
    return data.choices[0].message.content;
  }
}
