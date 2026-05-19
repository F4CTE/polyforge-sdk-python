import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ apiKeyMeta?: unknown }>();

    if (request.apiKeyMeta) {
      throw new ForbiddenException({
        code: "SESSION_REQUIRED",
        message: "This endpoint requires an authenticated user session",
      });
    }

    return true;
  }
}
