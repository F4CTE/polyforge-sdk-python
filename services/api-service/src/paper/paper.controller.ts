import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@polyforge/shared-auth';
import { PaperService } from './paper.service';

@ApiTags('paper')
@ApiBearerAuth('jwt')
@Controller('paper')
@UseGuards(JwtAuthGuard)
export class PaperController {
    constructor(private readonly paper: PaperService) {}

    @Get('summary')
    getSummary(@CurrentUser() user: any) {
        return this.paper.getSummary(user.sub);
    }

    @Post('reset')
    reset(@CurrentUser() user: any) {
        return this.paper.reset(user.sub);
    }
}
