import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET!,
      signOptions: { expiresIn: "1h" },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
