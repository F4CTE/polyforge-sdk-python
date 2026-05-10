import { Global, Module } from "@nestjs/common";
import { PrismaAdminService } from "./prisma-admin.service";

@Global()
@Module({
  providers: [PrismaAdminService],
  exports: [PrismaAdminService],
})
export class SharedAdminDbModule {}
