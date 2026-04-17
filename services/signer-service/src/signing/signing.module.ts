import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "@polyforge/shared-redis";
import { SigningController } from "./signing.controller";
import { SigningService } from "./signing.service";
import { NativeEip712Service } from "./native-eip712.service";
import { CredentialsModule } from "../credentials/credentials.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [CredentialsModule, JwtModule.register({}), RedisModule],
  controllers: [SigningController],
  providers: [SigningService, NativeEip712Service, InternalAuthGuard],
})
export class SigningModule {}
