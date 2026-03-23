import {
  IsOptional,
  IsEnum,
  IsNumberString,
} from "class-validator";
import { CopyModeDto } from "./create-copy.dto";

export class UpdateCopyDto {
  @IsOptional()
  @IsEnum(CopyModeDto)
  mode?: CopyModeDto;

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
