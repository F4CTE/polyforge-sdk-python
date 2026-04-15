import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export enum SmartOrderTypeDto {
  TWAP = "TWAP",
  DCA = "DCA",
  BRACKET = "BRACKET",
  OCO = "OCO",
}

export class PlaceSmartOrderDto {
  @IsEnum(SmartOrderTypeDto)
  type: SmartOrderTypeDto;

  @IsString()
  tokenId: string;

  @IsEnum(["BUY", "SELL"])
  side: "BUY" | "SELL";

  @IsEnum(["YES", "NO"])
  outcome: "YES" | "NO";

  /** Total size in USDC (for TWAP/DCA) or entry size (for BRACKET/OCO) */
  @IsNumber()
  @Min(1)
  totalSize: number;

  // ── TWAP / DCA ──────────────────────────────────────────────────────────

  /** Number of equal slices to split the order into (TWAP/DCA) */
  @ValidateIf(
    (o: PlaceSmartOrderDto) =>
      o.type === SmartOrderTypeDto.TWAP || o.type === SmartOrderTypeDto.DCA,
  )
  @IsInt()
  @Min(2)
  @Max(100)
  slices?: number;

  /** Minutes between each slice execution */
  @ValidateIf(
    (o: PlaceSmartOrderDto) =>
      o.type === SmartOrderTypeDto.TWAP || o.type === SmartOrderTypeDto.DCA,
  )
  @IsInt()
  @Min(1)
  @Max(10080) // 1 week max
  intervalMinutes?: number;

  /** Limit price for each slice (optional — uses market price if omitted) */
  @ValidateIf(
    (o: PlaceSmartOrderDto) =>
      o.type === SmartOrderTypeDto.TWAP || o.type === SmartOrderTypeDto.DCA,
  )
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  limitPrice?: number;

  // ── BRACKET ─────────────────────────────────────────────────────────────

  /** Entry limit price for the bracket order */
  @ValidateIf((o: PlaceSmartOrderDto) => o.type === SmartOrderTypeDto.BRACKET)
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  entryPrice?: number;

  /** Take-profit price (must be higher than entry for BUY) */
  @ValidateIf((o: PlaceSmartOrderDto) => o.type === SmartOrderTypeDto.BRACKET)
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  takeProfitPrice?: number;

  /** Stop-loss price (must be lower than entry for BUY) */
  @ValidateIf((o: PlaceSmartOrderDto) => o.type === SmartOrderTypeDto.BRACKET)
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  stopLossPrice?: number;

  // ── OCO ─────────────────────────────────────────────────────────────────

  /** First leg price */
  @ValidateIf((o: PlaceSmartOrderDto) => o.type === SmartOrderTypeDto.OCO)
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  priceA?: number;

  /** Second leg price */
  @ValidateIf((o: PlaceSmartOrderDto) => o.type === SmartOrderTypeDto.OCO)
  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  priceB?: number;
}
