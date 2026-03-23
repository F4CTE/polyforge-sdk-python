import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminJwtGuard } from "./admin-jwt.guard";
import { RolesGuard } from "./roles.guard";

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AdminJwtGuard, RolesGuard],
  exports: [AdminJwtGuard, RolesGuard, JwtModule],
})
export class AdminGuardModule {}
