import { Module } from "@nestjs/common";
import { GammaController } from "./gamma.controller";

@Module({ controllers: [GammaController] })
export class GammaModule {}
