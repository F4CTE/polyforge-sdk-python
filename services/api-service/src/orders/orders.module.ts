import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ConditionalController } from "./conditional.controller";
import { ConditionalEvaluatorService } from "./conditional-evaluator.service";

@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({})],
  controllers: [OrdersController, ConditionalController],
  providers: [OrdersService, ConditionalEvaluatorService],
})
export class OrdersModule {}
