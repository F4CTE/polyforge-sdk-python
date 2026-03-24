import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser } from "@polyforge/shared-auth";
import { FastifyRequest } from "fastify";
import { BatchService } from "./batch.service";
import { BatchRequestDto } from "./dto/batch-request.dto";

@ApiTags("batch")
@ApiBearerAuth("jwt")
@Controller("batch")
@UseGuards(JwtAuthGuard)
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post()
  @HttpCode(200)
  async executeBatch(
    @CurrentUser() _user: any,
    @Body() dto: BatchRequestDto,
    @Req() req: FastifyRequest,
  ) {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const port = parseInt(process.env.PORT ?? "3002", 10);

    const results = await this.batchService.executeBatch(
      dto.items,
      token,
      port,
    );
    return { results };
  }
}
