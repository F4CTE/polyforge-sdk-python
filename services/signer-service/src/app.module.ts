import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from '@polyforge/logger';
import { EncryptionModule } from './encryption/encryption.module';
import { CredentialsModule } from './credentials/credentials.module';
import { SigningModule } from './signing/signing.module';
import { CanaryModule } from './canary/canary.module';
import { HealthController } from './health/health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({}),
        LoggerModule,
        EncryptionModule,
        CredentialsModule,
        SigningModule,
        CanaryModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
