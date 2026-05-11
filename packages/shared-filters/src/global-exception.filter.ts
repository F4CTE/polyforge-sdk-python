import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SentryExceptionCaptured } from "@sentry/nestjs";
import { randomUUID } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { mapPrismaException } from "./prisma-exception.filter";

const AI_SUGGESTIONS: Record<string, string> = {
  STRATEGY_LIMIT_REACHED: "Delete unused strategies to make room",
  ALERT_LIMIT_REACHED: "Remove triggered or unnecessary alerts",
  NOT_CONNECTED: "Import Polymarket credentials in Settings > Trading Account",
  ALREADY_RUNNING: "Stop the strategy first, then start again",
  GEO_BLOCKED: "Trading is not available in your region",
  INSUFFICIENT_SCOPES:
    "Your API key needs additional scopes. Generate a new key with the required scope.",
  RATE_LIMITED:
    "Wait a moment and try again. Consider using the batch endpoint for multiple operations.",
  UNAUTHORIZED: "Provide a valid Bearer JWT in the Authorization header",
  FORBIDDEN: "You do not have permission to access this resource",
  NOT_FOUND: "The requested resource does not exist. Verify the ID and path.",
  VALIDATION_ERROR:
    "Check the request body against the schema at GET /api/v1/actions",
  CONFLICT: "The resource is in a conflicting state. Refresh and retry.",
};

type ErrorEnvelope = {
  statusCode: number;
  code: string;
  message: string | string[];
  suggestion?: string;
  requestId: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = randomUUID();
    const response = this.toEnvelope(exception, requestId);

    if (response.statusCode >= 500) {
      this.logServerError(exception, request, requestId);
    }

    reply.status(response.statusCode).send(response);
  }

  private toEnvelope(exception: unknown, requestId: string): ErrorEnvelope {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = mapPrismaException(exception);
      return {
        ...prismaError,
        requestId,
      };
    }

    const isCorsError =
      exception instanceof Error && exception.message.startsWith("CORS:");
    const statusCode = isCorsError
      ? HttpStatus.FORBIDDEN
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isProduction = process.env.NODE_ENV === "production";
    const httpResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const normalized = normalizeHttpResponse(httpResponse);

    const code = isCorsError
      ? "CORS_FORBIDDEN"
      : statusCode >= 500 && isProduction
        ? "INTERNAL_SERVER_ERROR"
        : (normalized.code ??
          (exception instanceof HttpException
            ? exception.constructor.name.toUpperCase()
            : "INTERNAL_SERVER_ERROR"));
    const message = isCorsError
      ? "Forbidden"
      : statusCode >= 500 && isProduction
        ? "Internal server error"
        : (normalized.message ??
          (exception instanceof HttpException
            ? exception.message
            : "Internal server error"));
    const suggestion = AI_SUGGESTIONS[code];

    return {
      statusCode,
      code,
      message,
      ...(suggestion ? { suggestion } : {}),
      requestId,
    };
  }

  private logServerError(
    exception: unknown,
    request: FastifyRequest,
    requestId: string,
  ) {
    const message =
      exception instanceof Error ? exception.message : String(exception);
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${message}`,
    );

    if (
      exception instanceof Error &&
      exception.stack &&
      process.env.NODE_ENV !== "production"
    ) {
      this.logger.error(exception.stack);
    }
  }
}

function normalizeHttpResponse(response: unknown): {
  code?: string;
  message?: string | string[];
} {
  if (typeof response === "string") {
    return { message: response };
  }

  if (response == null || typeof response !== "object") {
    return {};
  }

  const body = response as Record<string, unknown>;
  return {
    code: typeof body.code === "string" ? body.code : undefined,
    message:
      typeof body.message === "string" || Array.isArray(body.message)
        ? (body.message as string | string[])
        : undefined,
  };
}
