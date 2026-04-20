import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SigningController } from "./signing.controller";
import { InternalSigningController } from "./internal-signing.controller";
import { SigningService } from "./signing.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NativeCtfService } from "./native-ctf.service";
import { CredentialsModule } from "../credentials/credentials.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [CredentialsModule, JwtModule.register({})],
  controllers: [SigningController, InternalSigningController],
  providers: [
    SigningService,
    NativeEip712Service,
    NativeCtfService,
    InternalAuthGuard,
  ],
})
export class SigningModule {}
