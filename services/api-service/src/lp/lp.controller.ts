import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, ApiKeyScopeGuard, RequireScopes, CurrentUser } from '@polyforge/shared-auth';
import { LpService } from './lp.service';
import { ProvideLiquidityDto } from './dto/provide-liquidity.dto';

@ApiTags('lp')
@ApiBearerAuth('jwt')
@Controller('lp')
@UseGuards(JwtAuthGuard)
export class LpController {
  constructor(private readonly lp: LpService) {}

  @Post('provide')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyScopeGuard)
  @RequireScopes('TRADE')
  provideLiquidity(@CurrentUser() user: any, @Body() dto: ProvideLiquidityDto) {
    return this.lp.provideLiquidity(user.sub, dto);
  }
}
