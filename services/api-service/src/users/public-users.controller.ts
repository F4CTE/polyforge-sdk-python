import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PublicUsersService } from "./public-users.service";

@ApiTags("users")
@Controller("users")
export class PublicUsersController {
  constructor(private readonly publicUsers: PublicUsersService) {}

  @Get(":username/performance")
  getPerformance(
    @Param("username") username: string,
    @Query("period") period: string = "30d",
  ) {
    return this.publicUsers.getPerformance(username, period);
  }

  @Get(":username/strategies")
  getStrategies(
    @Param("username") username: string,
    @Query("visibility") visibility: string = "PUBLIC",
    @Query("limit", new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.publicUsers.getStrategies(username, visibility, limit);
  }

  @Get(":username/activity")
  getActivity(
    @Param("username") username: string,
    @Query("limit", new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.publicUsers.getActivity(username, limit);
  }

  @Get(":username/badges")
  getBadges(@Param("username") username: string) {
    return this.publicUsers.getBadges(username);
  }
}
