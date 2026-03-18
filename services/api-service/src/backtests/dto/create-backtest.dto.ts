import {
  IsOptional,
  IsString,
  IsBoolean,
  IsISO8601,
  IsObject,
} from "class-validator";

export class CreateBacktestDto {
  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsISO8601()
  dateRangeStart?: string;

  @IsOptional()
  @IsISO8601()
  dateRangeEnd?: string;

  @IsOptional()
  @IsBoolean()
  quickMode?: boolean = false;

  @IsOptional()
  @IsObject()
  strategyBlocks?: Record<string, unknown>;
}
