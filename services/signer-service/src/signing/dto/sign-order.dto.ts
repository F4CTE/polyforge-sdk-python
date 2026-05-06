import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from "class-validator";

const DECIMAL_6_RE = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;

function decimalToUnits(value: string): bigint | null {
  if (!DECIMAL_6_RE.test(value)) return null;

  const [integer, fractional = ""] = value.split(".");
  return BigInt(integer) * 1_000_000n + BigInt(fractional.padEnd(6, "0"));
}

function DecimalUnitsRange(
  minExclusive: bigint,
  maxInclusive: bigint | null,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "decimalUnitsRange",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          const units = decimalToUnits(value);
          if (units === null || units <= minExclusive) return false;
          return maxInclusive === null || units <= maxInclusive;
        },
      },
    });
  };
}

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

  @IsString()
  @Matches(DECIMAL_6_RE, {
    message: "Order size must be a decimal string with at most 6 decimals",
  })
  @DecimalUnitsRange(0n, null, {
    message: "Order size must be greater than 0",
  })
  size!: string;

  @IsString()
  @Matches(DECIMAL_6_RE, {
    message: "Order price must be a decimal string with at most 6 decimals",
  })
  @DecimalUnitsRange(0n, 1_000_000n, {
    message: "Order price must be greater than 0 and at most 1",
  })
  price!: string;

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
