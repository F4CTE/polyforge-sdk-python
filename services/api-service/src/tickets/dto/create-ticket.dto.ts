import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  declare subject: string;

  @IsOptional()
  @IsIn([
    "GENERAL",
    "BILLING",
    "TECHNICAL",
    "ACCOUNT",
    "BUG",
    "FEATURE_REQUEST",
  ])
  category?: string = "GENERAL";

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  declare body: string;
}
