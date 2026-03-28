import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { TicketsService } from "./tickets.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateMessageDto } from "./dto/create-message.dto";

@ApiTags("tickets")
@ApiBearerAuth("jwt")
@Controller("tickets")
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user.sub, user.username, dto);
  }

  @Get()
  list(
    @CurrentUser() user: any,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.tickets.listMy(user.sub, page, limit);
  }

  @Get(":id")
  getOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.tickets.getOne(id, user.sub);
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  addMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() dto: CreateMessageDto,
  ) {
    return this.tickets.addMessage(id, user.sub, user.username, dto);
  }
}
