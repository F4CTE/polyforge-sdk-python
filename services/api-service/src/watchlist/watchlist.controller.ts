import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { WatchlistService } from './watchlist.service';
import { IsString } from 'class-validator';

class AddWatchlistDto {
  @IsString() marketId!: string;
}

@ApiTags('watchlist')
@ApiBearerAuth('jwt')
@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.watchlist.list(user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@CurrentUser() user: any, @Body() dto: AddWatchlistDto) {
    return this.watchlist.add(user.sub, dto.marketId);
  }

  @Delete(':marketId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: any, @Param('marketId') marketId: string) {
    return this.watchlist.remove(user.sub, marketId);
  }

  @Get(':marketId/status')
  status(@CurrentUser() user: any, @Param('marketId') marketId: string) {
    return this.watchlist.isWatched(user.sub, marketId);
  }
}
