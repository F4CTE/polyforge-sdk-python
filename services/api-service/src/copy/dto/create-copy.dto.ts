import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumberString,
  MaxLength,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { checksumEthereumAddress } from "../wallet-address";

export enum CopyModeDto {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
  MIRROR = "MIRROR",
}

@ValidatorConstraint({ name: "isEthereumAddressChecksum", async: false })
class IsEthereumAddressChecksum implements ValidatorConstraintInterface {
  validate(value: string) {
    if (typeof value !== "string") return false;
    try {
      checksumEthereumAddress(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return "Invalid Ethereum address — must be a valid EIP-55 checksummed address or all-lowercase/uppercase";
  }
}

export class CreateCopyDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid Ethereum address format",
  })
  @Validate(IsEthereumAddressChecksum)
  declare targetWallet: string;

  @IsOptional()
  @IsEnum(CopyModeDto)
  mode?: CopyModeDto = CopyModeDto.PERCENTAGE;

  @IsOptional()
  @IsNumberString()
  sizeValue?: string;

  @IsOptional()
  @IsNumberString()
  maxExposure?: string;

  @IsOptional()
  @IsNumberString()
  maxDailyLoss?: string;

  @IsOptional()
  @IsNumberString()
  priceOffset?: string;
}
