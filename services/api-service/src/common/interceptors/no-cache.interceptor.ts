import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { Observable } from "rxjs";

@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    if (reply?.header) {
      reply.header(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
    }
    return next.handle();
  }
}
