import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  IsIn,
} from "class-validator";

export class SignPolymarketUsRequestDto {
  @IsUUID()
  userId!: string;

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
