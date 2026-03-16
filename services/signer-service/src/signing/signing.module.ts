import { Module } from '@nestjs/common';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { CredentialsModule } from '../credentials/credentials.module';

@Module({
    imports: [CredentialsModule],
    controllers: [SigningController],
    providers: [SigningService],
})
export class SigningModule {}
