import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "@polyforge/shared-types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Accept token from HttpOnly cookie (browser) or Authorization header (API clients)
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.pf_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = process.env.USER_JWT_SECRET;
        if (!secret) throw new Error('USER_JWT_SECRET environment variable is required');
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
