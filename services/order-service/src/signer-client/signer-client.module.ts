import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SignerClientService } from './signer-client.service';

@Module({
    imports: [JwtModule.register({})],
    providers: [SignerClientService],
    exports: [SignerClientService],
})
export class SignerClientModule {}
