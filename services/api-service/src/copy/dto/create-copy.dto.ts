import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumberString,
  MaxLength,
  Matches,
} from "class-validator";

export enum CopyModeDto {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
  MIRROR = "MIRROR",
}

export class CreateCopyDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  declare targetWallet: string;

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
