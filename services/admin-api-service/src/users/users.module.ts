import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "@polyforge/shared-redis";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AdminMailModule } from "../mail/mail.module";

@Module({
  imports: [AdminMailModule, ConfigModule, JwtModule.register({}), RedisModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
