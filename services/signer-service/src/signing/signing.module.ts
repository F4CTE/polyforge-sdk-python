import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@polyforge/shared-redis';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { CredentialsModule } from '../credentials/credentials.module';
import { InternalAuthGuard } from '../common/internal-auth.guard';

@Module({
    imports: [CredentialsModule, JwtModule.register({}), RedisModule],
    controllers: [SigningController],
    providers: [SigningService, InternalAuthGuard],
})
export class SigningModule {}
