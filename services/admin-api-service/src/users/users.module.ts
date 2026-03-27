import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AdminMailModule } from "../mail/mail.module";

@Module({
  imports: [AdminMailModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
