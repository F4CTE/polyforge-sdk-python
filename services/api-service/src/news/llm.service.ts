import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export class LlmServiceError extends Error {
  constructor(
    message: string,
    public readonly meta: { provider: string; statusCode?: number },
  ) {
    super(message);
    this.name = "LlmServiceError";
  }
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {
    if (
      !this.config.get<string>("ANTHROPIC_API_KEY") &&
      !this.config.get<string>("OPENAI_API_KEY")
    ) {
      this.logger.warn(
        "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-powered features.",
      );
    }
  }

  async analyze(prompt: string): Promise<string> {
    const claudeApiKey = this.config.get<string>("ANTHROPIC_API_KEY", "");
    const openaiApiKey = this.config.get<string>("OPENAI_API_KEY", "");

    if (claudeApiKey) {
      try {
        return await this.callClaude(prompt, claudeApiKey);
      } catch (err: unknown) {
        const status =
          err instanceof LlmServiceError ? err.meta.statusCode : undefined;
        this.logger.warn(
          { provider: "claude", statusCode: status },
          "Claude API call failed, falling back to OpenAI",
        );
      }
    }

    if (openaiApiKey) {
      try {
        return await this.callOpenAI(prompt, openaiApiKey);
      } catch (err: unknown) {
        const status =
          err instanceof LlmServiceError ? err.meta.statusCode : undefined;
        this.logger.error(
          { provider: "openai", statusCode: status },
          "OpenAI API call also failed",
        );
        throw new LlmServiceError("All LLM providers failed", {
          provider: "all",
          statusCode: status,
        });
      }
    }

    throw new LlmServiceError(
      "No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
      { provider: "none" },
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
      // Consume body to release the connection but never propagate it —
      // upstream error bodies may echo the user's prompt.
      await res.text();
      this.logger.error(
        { provider: "claude", statusCode: res.status },
        "LLM call failed",
      );
      throw new LlmServiceError("LLM request failed", {
        provider: "claude",
        statusCode: res.status,
      });
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
      await res.text();
      this.logger.error(
        { provider: "openai", statusCode: res.status },
        "LLM call failed",
      );
      throw new LlmServiceError("LLM request failed", {
        provider: "openai",
        statusCode: res.status,
      });
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0].message.content;
  }
}
