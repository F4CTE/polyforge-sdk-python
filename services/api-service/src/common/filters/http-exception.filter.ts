import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const reply = ctx.getResponse<FastifyReply>();
        const request = ctx.getRequest<FastifyRequest>();

        const requestId = randomUUID();
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message = exception instanceof HttpException
            ? (exception.getResponse() as any).message ?? exception.message
            : 'Internal server error';

        const code = exception instanceof HttpException
            ? (exception.getResponse() as any).code ?? exception.constructor.name.toUpperCase()
            : 'INTERNAL_ERROR';

        if (status >= 500) {
            this.logger.error(`[${requestId}] ${request.method} ${request.url}`, exception);
        }

        reply.status(status).send({
            statusCode: status,
            code,
            message,
            requestId,
        });
    }
}
