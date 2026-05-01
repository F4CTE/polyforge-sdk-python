import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

interface MinimalReply {
  status(code: number): MinimalReply;
  send(body: unknown): unknown;
}

interface MinimalRequest {
  method: string;
  url: string;
}

/**
 * Maps Prisma client errors to safe HTTP responses so schema details (table /
 * column / constraint names) are not leaked to clients via raw 500s.
 *
 * Registered before the global exception filter so it handles
 * PrismaClientKnownRequestError specifically; everything else falls through
 * to the per-service GlobalExceptionFilter.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<MinimalReply>();
    const request = ctx.getRequest<MinimalRequest>();

    const requestId = randomUUID();
    const isProduction = process.env.NODE_ENV === "production";

    let status: number;
    let code: string;
    let message: string;

    switch (exception.code) {
      case "P2002": {
        status = HttpStatus.CONFLICT;
        code = "UNIQUE_CONSTRAINT_VIOLATION";
        message = "A resource with these unique fields already exists";
        break;
      }
      case "P2025": {
        status = HttpStatus.NOT_FOUND;
        code = "NOT_FOUND";
        message = "The requested resource does not exist";
        break;
      }
      case "P2003": {
        status = HttpStatus.BAD_REQUEST;
        code = "FOREIGN_KEY_VIOLATION";
        message = "Referenced resource does not exist";
        break;
      }
      case "P2014": {
        status = HttpStatus.BAD_REQUEST;
        code = "INVALID_RELATION";
        message = "The change would violate a required relation";
        break;
      }
      default: {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = "DATABASE_ERROR";
        message = isProduction ? "Internal server error" : exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} — Prisma ${exception.code}: ${exception.message}`,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} — Prisma ${exception.code}`,
      );
    }

    reply.status(status).send({
      statusCode: status,
      code,
      message,
      requestId,
    });
  }
}
