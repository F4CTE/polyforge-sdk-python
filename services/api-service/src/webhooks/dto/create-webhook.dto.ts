import {
  IsString,
  IsArray,
  IsUrl,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  MaxLength,
} from "class-validator";

const VALID_EVENTS = [
  "ORDER_FILLED",
  "STRATEGY_ERROR",
  "WHALE_TRADE",
  "NEWS_SIGNAL",
  "BACKTEST_COMPLETE",
  "DAILY_LOSS_LIMIT",
  "MARKET_RESOLVED",
  "PRICE_ALERT",
] as const;

export class CreateWebhookDto {
  @IsUrl({ require_tld: true }, { message: "Webhook URL must use HTTPS" })
  @MaxLength(1000)
  declare url: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsIn(VALID_EVENTS, { each: true })
  declare events: string[];
}
