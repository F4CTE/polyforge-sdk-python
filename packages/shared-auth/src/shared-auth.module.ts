import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { InternalJwtGuard } from "./internal-jwt.guard";
import { AdminJwtGuard } from "./admin-jwt.guard";
import { RolesGuard } from "./roles.guard";
import { ApiKeyScopeGuard } from "./api-key-scopes.guard";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: process.env.USER_JWT_SECRET!,
      signOptions: { expiresIn: "7d" },
    }),
  ],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    InternalJwtGuard,
    AdminJwtGuard,
    RolesGuard,
    ApiKeyScopeGuard,
  ],
  exports: [
    JwtModule,
    JwtStrategy,
    JwtAuthGuard,
    InternalJwtGuard,
    AdminJwtGuard,
    RolesGuard,
    ApiKeyScopeGuard,
  ],
})
export class SharedAuthModule {}
