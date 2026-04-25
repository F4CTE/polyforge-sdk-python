import { Module } from "@nestjs/common";
import { PublicUsersController } from "./public-users.controller";
import { PublicUsersService } from "./public-users.service";

@Module({
  controllers: [PublicUsersController],
  providers: [PublicUsersService],
})
export class UsersModule {}
