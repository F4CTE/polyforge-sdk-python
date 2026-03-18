import { Controller, Get, UseGuards } from "@nestjs/common";
import { BuilderService } from "./builder.service";
import { AdminJwtGuard } from "../common/guard/admin-jwt.guard";

@UseGuards(AdminJwtGuard)
@Controller("builder")
export class BuilderController {
  constructor(private readonly builder: BuilderService) {}

  @Get("stats")
  getStats() {
    return this.builder.getStats();
  }
}
