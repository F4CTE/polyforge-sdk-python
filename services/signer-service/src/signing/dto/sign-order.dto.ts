import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsIn,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from "class-validator";

export class SignOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requestId!: string;

  /** Token ID (Polymarket condition ID + outcome index) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tokenId!: string;

  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  /** Size in shares */
  @IsNumber()
  @Min(0)
  size!: number;

  /** Limit price (0-1) */
  @IsNumber()
  @Min(0)
  price!: number;

  @IsIn(["GTC", "FOK", "GTD", "FAK"])
  orderType!: "GTC" | "FOK" | "GTD" | "FAK";

  /** GTD expiry (Unix ms), required when orderType = GTD */
  @IsNumber()
  @IsOptional()
  expiration?: number;

  /** Tick size for the market (e.g. "0.01" or "0.001") */
  @IsOptional()
  @IsString()
  tickSize?: string;

  /** Whether this is a neg-risk market */
  @IsOptional()
  @IsBoolean()
  negRisk?: boolean;

  /** If true, order must be maker-only (rejected if it would cross) */
  @IsOptional()
  @IsBoolean()
  postOnly?: boolean;

  /** Optional taker address for directed orders */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  taker?: string;
}
