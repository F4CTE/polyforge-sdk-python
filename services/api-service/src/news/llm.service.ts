import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {
    // M-04: Validate at startup that at least one API key is configured.
    // Keys are read on-demand via ConfigService (not cached as class fields)
    // to minimize credential exposure window in V8 heap memory.
    if (
      !this.config.get<string>("ANTHROPIC_API_KEY") &&
      !this.config.get<string>("OPENAI_API_KEY")
    ) {
      this.logger.warn(
        "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-powered features.",
      );
    }
  }

  /**
   * Analyze a prompt using LLM. Tries Claude first, falls back to GPT-4o.
   */
  async analyze(prompt: string): Promise<string> {
    const claudeApiKey = this.config.get<string>("ANTHROPIC_API_KEY", "");
    const openaiApiKey = this.config.get<string>("OPENAI_API_KEY", "");

    if (claudeApiKey) {
      try {
        return await this.callClaude(prompt, claudeApiKey);
      } catch (err: any) {
        this.logger.warn(
          `Claude API call failed, falling back to OpenAI: ${err?.message}`,
        );
      }
    }

    if (openaiApiKey) {
      try {
        return await this.callOpenAI(prompt, openaiApiKey);
      } catch (err: any) {
        this.logger.error(`OpenAI API call also failed: ${err?.message}`);
        throw new Error("All LLM providers failed", { cause: err });
      }
    }

    throw new Error(
      "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
    );
  }

  private async callClaude(prompt: string, apiKey: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
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

    const data = (await res.json()) as { content: { text: string }[] };
    return data.content[0].text;
  }

  private async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0].message.content;
  }
}
