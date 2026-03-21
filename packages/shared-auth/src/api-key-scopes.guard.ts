import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_SCOPES } from "./api-key-scopes.decorator";

@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_SCOPES,
      [context.getHandler(), context.getClass()],
    );

    // No scopes required — allow
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Record<string, any>>();

    // JWT-based requests have full access (no apiKeyMeta)
    if (!request.apiKeyMeta) {
      return true;
    }

    const keyScopes: string[] = request.apiKeyMeta.scopes ?? [];
    const hasAllScopes = requiredScopes.every((scope) =>
      keyScopes.includes(scope),
    );

    if (!hasAllScopes) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_SCOPES",
        message: `API key requires scopes: ${requiredScopes.join(", ")}`,
      });
    }

    return true;
  }
}
