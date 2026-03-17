import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { IsOptional, IsIn, IsString } from 'class-validator';
import { DiscoverService } from './discover.service';
import { PaginationDto } from '../common/dto/pagination.dto';

class DiscoverQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['popular', 'newest', 'top_pnl', 'most_forked'])
    sort?: string = 'popular';

    @IsOptional()
    @IsString()
    category?: string;
}

class LeaderboardQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['7d', '30d', 'allTime'])
    period?: string = '30d';
}

@ApiTags('discover')
@ApiBearerAuth('jwt')
@Controller()
@UseGuards(JwtAuthGuard)
export class DiscoverController {
    constructor(private readonly discover: DiscoverService) {}

    @Get('discover')
    getDiscover(@CurrentUser() user: any, @Query() query: DiscoverQueryDto) {
        return this.discover.discover(user.sub, query);
    }

    @Get('leaderboard')
    getLeaderboard(@Query() query: LeaderboardQueryDto) {
        return this.discover.leaderboard(query);
    }
}
