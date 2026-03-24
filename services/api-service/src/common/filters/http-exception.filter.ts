import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";

const AI_SUGGESTIONS: Record<string, string> = {
  STRATEGY_LIMIT_REACHED: "Delete unused strategies to make room",
  ALERT_LIMIT_REACHED: "Remove triggered or unnecessary alerts",
  NOT_CONNECTED:
    "Import Polymarket credentials in Settings > Trading Account",
  ALREADY_RUNNING: "Stop the strategy first, then start again",
  GEO_BLOCKED: "Trading is not available in your region",
  INSUFFICIENT_SCOPES:
    "Your API key needs additional scopes. Generate a new key with the required scope.",
  RATE_LIMITED:
    "Wait a moment and try again. Consider using the batch endpoint for multiple operations.",
  UNAUTHORIZED: "Provide a valid Bearer JWT in the Authorization header",
  FORBIDDEN: "You do not have permission to access this resource",
  NOT_FOUND: "The requested resource does not exist. Verify the ID and path.",
  VALIDATION_ERROR: "Check the request body against the schema at GET /api/v1/actions",
  CONFLICT: "The resource is in a conflicting state. Refresh and retry.",
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestId = randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // R4-04: In production, mask error details for 500+ responses to prevent information leakage
    const isProduction = process.env.NODE_ENV === "production";

    const message =
      status >= 500 && isProduction
        ? "Internal server error"
        : exception instanceof HttpException
          ? ((exception.getResponse() as any).message ?? exception.message)
          : "Internal server error";

    const code =
      status >= 500 && isProduction
        ? "INTERNAL_SERVER_ERROR"
        : exception instanceof HttpException
          ? ((exception.getResponse() as any).code ??
            exception.constructor.name.toUpperCase())
          : "INTERNAL_ERROR";

    if (status >= 500) {
      const errMsg = exception instanceof Error ? exception.message : String(exception);
      const errStack = exception instanceof Error ? exception.stack : '';
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} — ${errMsg}`,
      );
      if (errStack && process.env.NODE_ENV !== 'production') {
        this.logger.error(errStack);
      }
    }

    const suggestion = AI_SUGGESTIONS[code] ?? undefined;

    reply.status(status).send({
      statusCode: status,
      code,
      message,
      ...(suggestion ? { suggestion } : {}),
      requestId,
    });
  }
}
