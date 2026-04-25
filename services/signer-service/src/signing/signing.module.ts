import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SharedDbModule } from "@polyforge/shared-db";
import { SigningController } from "./signing.controller";
import { InternalSigningController } from "./internal-signing.controller";
import { SigningService } from "./signing.service";
import { NativeEip712Service } from "./native-eip712.service";
import { NativeCtfService } from "./native-ctf.service";
import { Ed25519SigningService } from "./ed25519-signing.service";
import { CredentialsModule } from "../credentials/credentials.module";
import { EncryptionModule } from "../encryption/encryption.module";
import { InternalAuthGuard } from "../common/internal-auth.guard";

@Module({
  imports: [
    CredentialsModule,
    EncryptionModule,
    SharedDbModule,
    JwtModule.register({}),
  ],
  controllers: [SigningController, InternalSigningController],
  providers: [
    SigningService,
    NativeEip712Service,
    NativeCtfService,
    Ed25519SigningService,
    InternalAuthGuard,
  ],
  exports: [Ed25519SigningService],
})
export class SigningModule {}
