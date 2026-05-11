import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { Observable, of, throwError } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { RedisService } from "@polyforge/shared-redis";

const HEADER = "idempotency-key";
const TTL_SECONDS = 86_400; // 24h

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

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
      mergeMap(async (result) => {
        try {
          await this.redis.set(cacheKey, JSON.stringify(result), TTL_SECONDS);
          void this.redis
            .getClient()
            .del(lockKey)
            .catch(() => {});
        } catch (err) {
          this.logger.error(
            "Idempotency cache write failed — lock retained to prevent duplicate, result still returned",
            err instanceof Error ? err.message : err,
          );
          // Lock is NOT released — it will expire naturally (30s PX).
          // This prevents a concurrent request with the same key from being
          // processed while no cached result exists.
        }
        return result;
      }),
      catchError((err) => {
        void this.redis
          .getClient()
          .del(lockKey)
          .catch(() => {});
        return throwError(() => err);
      }),
    );
  }
}
