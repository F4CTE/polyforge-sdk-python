import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, ApiKeyScopeGuard, RequireScopes, CurrentUser } from '@polyforge/shared-auth';
import { AccuracyService } from './accuracy.service';

@ApiTags('accuracy')
@ApiBearerAuth('jwt')
@Controller('accuracy')
@UseGuards(JwtAuthGuard)
export class AccuracyController {
  constructor(private readonly accuracy: AccuracyService) {}

  @Get('me')
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('READ')
  getMyAccuracy(@CurrentUser() user: any) {
    return this.accuracy.getMyAccuracy(user.sub);
  }
}
