import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JournalController } from "./journal.controller";
import { JournalService } from "./journal.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [JournalController],
  providers: [JournalService],
})
export class JournalModule {}
