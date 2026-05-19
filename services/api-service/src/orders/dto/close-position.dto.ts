import {
  IsString,
  IsOptional,
  IsNumberString,
  MaxLength,
} from "class-validator";

export class ClosePositionDto {
  @IsString()
  @MaxLength(255)
  declare tokenId: string;

  @IsOptional()
  @IsNumberString()
  size?: string;

  @IsOptional()
  @IsNumberString()
  price?: string;
}
