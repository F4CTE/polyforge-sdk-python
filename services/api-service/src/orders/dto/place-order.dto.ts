import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export enum OrderSideDto {
  BUY = "BUY",
  SELL = "SELL",
}

export enum OrderOutcomeDto {
  YES = "YES",
  NO = "NO",
}

export enum OrderTypeDto {
  GTC = "GTC",
  FOK = "FOK",
  GTD = "GTD",
}

export class PlaceOrderDto {
  @IsString()
  tokenId: string;

  @IsEnum(OrderSideDto)
  side: OrderSideDto;

  @IsEnum(OrderOutcomeDto)
  outcome: OrderOutcomeDto;

  @IsNumber()
  @Min(1)
  size: number;

  @IsNumber()
  @Min(0.001)
  @Max(0.999)
  price: number;

  @IsOptional()
  @IsEnum(OrderTypeDto)
  orderType?: OrderTypeDto = OrderTypeDto.GTC;
}
