import { Module } from "@nestjs/common";
import { EncryptionService } from "./encryption.service";
import { NativeEncryptionService } from "./native-encryption.service";

/**
 * SECURITY: This module provides ONLY the Rust NAPI-RS encryption service.
 * The old Node.js EncryptionService is kept as a type alias for backward compatibility
 * but all crypto operations are handled by Rust with Zeroize memory safety.
 * If the NAPI addon is not available, the service REFUSES TO START.
 */
@Module({
  providers: [
    NativeEncryptionService,
    { provide: EncryptionService, useExisting: NativeEncryptionService },
  ],
  exports: [EncryptionService, NativeEncryptionService],
})
export class EncryptionModule {}
