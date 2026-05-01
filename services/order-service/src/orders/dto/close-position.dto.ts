import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
} from "class-validator";

export class ClosePositionDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  tokenId!: string;

  @IsString()
  @IsNotEmpty()
  marketId!: string;

  /** Size to close (shares, decimal string — non-negative, no scientific notation). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^\d+(\.\d+)?$/, {
    message:
      "size must be a non-negative decimal string (e.g. '10', '10.5'); negatives, signs, and scientific notation are rejected",
  })
  size!: string;

  @IsString()
  @IsOptional()
  strategyId?: string;
}
