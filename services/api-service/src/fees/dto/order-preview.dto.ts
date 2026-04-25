import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export enum PreviewSideDto {
  BUY = "BUY",
  SELL = "SELL",
}

export class OrderPreviewDto {
  @IsString()
  tokenId: string;

  @IsEnum(PreviewSideDto)
  side: PreviewSideDto;

  @IsNumber()
  @Min(1)
  size: number;

  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  price: number;

  @IsOptional()
  @IsString()
  orderType?: string;
}

export interface VenueFeeEstimate {
  venue: string;
  feeBps: number;
  feeUsd: number;
  totalCostUsd: number;
  isMaker: boolean;
}

export interface OrderPreviewResponse {
  polymarket: VenueFeeEstimate;
  kalshi: VenueFeeEstimate | null;
  savings: number;
  recommendedVenue: string;
  marketMatch: { matchId: string; confidence: number } | null;
}
