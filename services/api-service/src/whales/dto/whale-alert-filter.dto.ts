import {
  IsOptional,
  IsArray,
  IsString,
  IsNumberString,
  IsBoolean,
  IsIn,
  MaxLength,
  ArrayMaxSize,
} from "class-validator";

export class UpsertWhaleAlertFilterDto {
  @IsOptional()
  @IsNumberString()
  minSize?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  marketIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  walletAddresses?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsIn(["BUY", "SELL"], { each: true })
  sides?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
