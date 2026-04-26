import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import * as Sentry from "@sentry/nestjs";
import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "@polyforge/shared-types";

interface AuthenticatedRequest extends FastifyRequest {
  user?: JwtPayload;
}

@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.user) {
      Sentry.setUser({
        id: request.user.sub,
        email: request.user.email,
        username: request.user.username,
      });
    }

    const params = request.params as Record<string, string>;
    const strategyId = params["strategyId"] ?? params["id"];
    if (strategyId && request.url?.includes("strateg")) {
      Sentry.setTag("strategyId", strategyId);
    }

    return next.handle();
  }
}
