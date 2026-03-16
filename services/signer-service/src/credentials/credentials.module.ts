import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { SharedDbModule } from '@polyforge/shared-db';

@Module({
    imports: [SharedDbModule, EncryptionModule],
    controllers: [CredentialsController],
    providers: [CredentialsService],
    exports: [CredentialsService],
})
export class CredentialsModule {}
