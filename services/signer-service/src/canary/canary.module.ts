import { Module } from "@nestjs/common";
import { CanaryService } from "./canary.service";
import { EncryptionModule } from "../encryption/encryption.module";
import { SharedUserDbModule } from "@polyforge/shared-db";

@Module({
  imports: [SharedUserDbModule, EncryptionModule],
  providers: [CanaryService],
})
export class CanaryModule {}
