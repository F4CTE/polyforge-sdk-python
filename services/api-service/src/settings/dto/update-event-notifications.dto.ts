import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  ArrayMaxSize,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const VALID_EVENTS = [
  "ORDER_FILLED",
  "ORDER_CANCELLED",
  "STRATEGY_ERROR",
  "BACKTEST_COMPLETE",
  "DAILY_LOSS_LIMIT",
  "MARKET_RESOLVED",
  "PRICE_ALERT",
  "WHALE_TRADE",
  "NEWS_SIGNAL",
  "NEW_FOLLOWER",
  "NEW_LIKE",
  "NEW_COMMENT",
  "NEW_FORK",
  "TICKET_REPLY",
] as const;

export class EventPrefDto {
  @IsIn(VALID_EVENTS)
  event!: string;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class UpdateEventNotificationsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EventPrefDto)
  preferences?: EventPrefDto[];

  @IsOptional()
  @IsString()
  @IsIn(["off", "daily", "weekly"])
  emailDigest?: string;
}
