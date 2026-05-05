import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsIn,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from "class-validator";

function OrderTypeExpirationRule(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "orderTypeExpirationRule",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as SignOrderDto;
          const expiration = dto.expiration;
          if (dto.orderType === "GTD") {
            return (
              typeof expiration === "number" &&
              Number.isFinite(expiration) &&
              expiration > Math.floor(Date.now() / 1000) + 30
            );
          }
          return expiration === undefined || expiration === 0;
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as SignOrderDto;
          if (dto.orderType === "GTD") {
            return "Choose an expiration time at least 30 seconds in the future.";
          }
          return "Remove the expiration time for this order type.";
        },
      },
    });
  };
}

export class SignOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  requestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  tokenId!: string;

  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  @IsNumber()
  @Min(1, {
    message: "Order size must be at least 1 share (Polymarket minimum)",
  })
  size!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsIn(["GTC", "FOK", "GTD", "FAK"])
  orderType!: "GTC" | "FOK" | "GTD" | "FAK";

  @IsOptional()
  @IsNumber()
  @OrderTypeExpirationRule()
  expiration?: number;

  @OrderTypeExpirationRule()
  expirationRule?: never;

  @IsOptional()
  @IsString()
  tickSize?: string;

  @IsOptional()
  @IsBoolean()
  negRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  postOnly?: boolean;
}
