import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsIn,
} from "class-validator";

export class SignPolymarketUsRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requestId!: string;

  @IsIn(["GET", "POST", "PUT", "DELETE", "PATCH"])
  method!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  path!: string;

  @IsOptional()
  @IsString()
  body?: string;
}
