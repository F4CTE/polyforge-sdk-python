import { Module } from "@nestjs/common";
import { KeyRotationService } from "./key-rotation.service";
import { KeyRotationController } from "./key-rotation.controller";

@Module({
  providers: [KeyRotationService],
  controllers: [KeyRotationController],
})
export class KeyRotationModule {}
