import { IsString, IsOptional } from "class-validator";

export class RedeemPositionDto {
  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  marketId?: string;
}
