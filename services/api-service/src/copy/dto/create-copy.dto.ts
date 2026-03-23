import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumberString,
  MaxLength,
} from "class-validator";

export enum CopyModeDto {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
  MIRROR = "MIRROR",
}

export class CreateCopyDto {
  @IsString()
  @MaxLength(255)
  targetWallet: string;

  @IsOptional()
  @IsEnum(CopyModeDto)
  mode?: CopyModeDto = CopyModeDto.PERCENTAGE;

  @IsOptional()
  @IsNumberString()
  sizeValue?: string;

  @IsOptional()
  @IsNumberString()
  maxExposure?: string;

  @IsOptional()
  @IsNumberString()
  maxDailyLoss?: string;

  @IsOptional()
  @IsNumberString()
  priceOffset?: string;
}
