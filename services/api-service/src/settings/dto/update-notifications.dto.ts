import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationsDto {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() telegramEnabled?: boolean;
  @IsOptional() @IsBoolean() discordEnabled?: boolean;
  @IsOptional() @IsBoolean() onOrderFilled?: boolean;
  @IsOptional() @IsBoolean() onStrategyError?: boolean;
  @IsOptional() @IsBoolean() onBacktestComplete?: boolean;
  @IsOptional() @IsBoolean() onDailyLossLimit?: boolean;
  @IsOptional() @IsBoolean() onMarketResolved?: boolean;
  @IsOptional() @IsBoolean() onSomeoneForked?: boolean;
  @IsOptional() @IsBoolean() onSomeoneFollowed?: boolean;
  @IsOptional() @IsBoolean() onSomeoneLiked?: boolean;
  @IsOptional() @IsBoolean() onSomeoneCommented?: boolean;
}
