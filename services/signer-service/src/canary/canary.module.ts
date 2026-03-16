import { Module } from '@nestjs/common';
import { CanaryService } from './canary.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { SharedDbModule } from '@polyforge/shared-db';

@Module({
    imports: [SharedDbModule, EncryptionModule],
    providers: [CanaryService],
})
export class CanaryModule {}
