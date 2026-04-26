import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Observable, of, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { RedisService } from "@polyforge/shared-redis";

const HEADER = "idempotency-key";
const TTL_SECONDS = 86_400; // 24h

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const key = req.headers[HEADER];

    if (!key || typeof key !== "string" || key.length < 8 || key.length > 128) {
      throw new BadRequestException({
        code: "MISSING_IDEMPOTENCY_KEY",
        message: `Idempotency-Key header required (8-128 chars)`,
      });
    }

    const userId = req.user?.sub ?? "anon";
    const cacheKey = `idempotency:${req.method}:${req.url}:${userId}:${key}`;
    const lockKey = `${cacheKey}:lock`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return of(JSON.parse(cached));
    }

    const acquired = await this.redis
      .getClient()
      .set(lockKey, "1", "PX", 30_000, "NX");
    if (acquired !== "OK") {
      throw new ConflictException({
        code: "IDEMPOTENT_REQUEST_IN_FLIGHT",
        message: "A request with this Idempotency-Key is already in progress",
      });
    }

    return next.handle().pipe(
      tap((result) => {
        void this.redis
          .set(cacheKey, JSON.stringify(result), TTL_SECONDS)
          .then(() => this.redis.getClient().del(lockKey));
      }),
      catchError((err) => {
        void this.redis.getClient().del(lockKey);
        return throwError(() => err);
      }),
    );
  }
}
