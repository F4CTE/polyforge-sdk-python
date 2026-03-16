import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SharedDbModule } from '@polyforge/shared-db';
import { SignerClientModule } from '../signer-client/signer-client.module';
import { ClobClientModule } from '../clob-client/clob-client.module';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [SharedDbModule, SignerClientModule, ClobClientModule, EventsModule],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule {}
