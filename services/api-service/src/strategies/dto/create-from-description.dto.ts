import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";

export class CreateFromDescriptionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  declare description: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  marketId?: string;
}
