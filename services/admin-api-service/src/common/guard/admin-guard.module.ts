import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AdminJwtGuard } from "./admin-jwt.guard";
import { RolesGuard } from "./roles.guard";

@Global()
@Module({
  imports: [ConfigModule.forRoot(), JwtModule.register({})],
  providers: [AdminJwtGuard, RolesGuard],
  exports: [AdminJwtGuard, RolesGuard, JwtModule],
})
export class AdminGuardModule {}
