import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IsOptional, IsString, IsIn } from "class-validator";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { JwtPayload } from "@polyforge/shared-types";
import { PaginationDto } from "../common/dto/pagination.dto";
import { JournalService } from "./journal.service";
import { ORDER_MOODS } from "../orders/dto/update-order-journal.dto";

class JournalQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(ORDER_MOODS)
  mood?: string;
}

@ApiTags("journal")
@ApiBearerAuth("jwt")
@Controller("journal")
@UseGuards(JwtAuthGuard)
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: JournalQueryDto) {
    return this.journal.list(user.sub, query);
  }
}
