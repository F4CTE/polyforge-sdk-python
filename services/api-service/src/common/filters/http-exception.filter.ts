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

    reply.status(status).send({
      statusCode: status,
      code,
      message,
      requestId,
    });
  }
}
