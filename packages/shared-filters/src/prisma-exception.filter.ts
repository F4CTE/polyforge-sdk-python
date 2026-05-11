import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SentryExceptionCaptured } from "@sentry/nestjs";
import { randomUUID } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type PrismaErrorResponse = {
  statusCode: number;
  code: string;
  message: string;
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  @SentryExceptionCaptured()
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = randomUUID();
    const response = mapPrismaException(exception);

    if (response.statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} — Prisma ${exception.code}: ${exception.message}`,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} — Prisma ${exception.code}`,
      );
    }

    reply.status(response.statusCode).send({
      ...response,
      requestId,
    });
  }
}

export function mapPrismaException(
  exception: Prisma.PrismaClientKnownRequestError,
): PrismaErrorResponse {
  const isProduction = process.env.NODE_ENV === "production";
  switch (exception.code) {
    case "P2002":
      return {
        statusCode: HttpStatus.CONFLICT,
        code: "UNIQUE_CONSTRAINT_VIOLATION",
        message: "A resource with these unique fields already exists",
      };
    case "P2003":
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: "FOREIGN_KEY_VIOLATION",
        message: "Referenced resource does not exist",
      };
    case "P2014":
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: "INVALID_RELATION",
        message: "The change would violate a required relation",
      };
    case "P2025":
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: "NOT_FOUND",
        message: "The requested resource does not exist",
      };
    default:
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: "DATABASE_ERROR",
        message: isProduction ? "Internal server error" : exception.message,
      };
  }
}
