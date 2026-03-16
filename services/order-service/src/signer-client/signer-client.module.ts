import { Module } from '@nestjs/common';
import { SignerClientService } from './signer-client.service';

@Module({
    providers: [SignerClientService],
    exports: [SignerClientService],
})
export class SignerClientModule {}
