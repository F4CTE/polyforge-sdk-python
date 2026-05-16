import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "@polyforge/shared-types";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: { cookies?: Record<string, string> }) =>
          req?.cookies?.pf_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ["HS256"],
      secretOrKey: (() => {
        const secret = process.env.USER_JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error("USER_JWT_SECRET environment variable is required");
        }
        return secret;
      })(),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
