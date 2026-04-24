import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateArbitrageAlertDto {
  @IsNumberString()
  declare minSpreadPct: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketId?: string;
}
