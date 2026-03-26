import { Module } from "@nestjs/common";
import { EncryptionService } from "./encryption.service";
import { NativeEncryptionService } from "./native-encryption.service";

@Module({
  providers: [
    NativeEncryptionService,
    // Alias: consumers injecting EncryptionService get the native version
    { provide: EncryptionService, useExisting: NativeEncryptionService },
  ],
  exports: [EncryptionService, NativeEncryptionService],
})
export class EncryptionModule {}
