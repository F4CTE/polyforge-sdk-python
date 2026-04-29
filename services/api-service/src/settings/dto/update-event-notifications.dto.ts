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
  "ORDER_REJECTED",
  "POSITION_CLOSED",
  "STRATEGY_ERROR",
  "STRATEGY_PAUSED",
  "BACKTEST_COMPLETE",
  "DAILY_LOSS_LIMIT",
  "MARKET_RESOLVED",
  "PRICE_ALERT",
  "WHALE_TRADE",
  "NEWS_SIGNAL",
  "COPY_TRADE",
  "NEW_FOLLOWER",
  "FOLLOWER_NEW",
  "NEW_LIKE",
  "NEW_COMMENT",
  "NEW_FORK",
  "REVIEW_RECEIVED",
  "TICKET_REPLY",
] as const;

const VALID_EMAIL_DIGESTS = [
  "off",
  "daily",
  "weekly",
  "NONE",
  "DAILY",
  "WEEKLY",
  "INSTANT",
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
  @IsIn(VALID_EMAIL_DIGESTS)
  emailDigest?: string;
}
