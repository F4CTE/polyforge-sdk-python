import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
} from "class-validator";

export class ImportCredentialsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  /** Polymarket EOA private key (hex, 0x-prefixed) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(132)
  privateKey!: string;

  /** L2 API key */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiKey!: string;

  /** L2 API secret */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiSecret!: string;

  /** L2 API passphrase */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  apiPassphrase!: string;

  /** Safe address (only for sig_type 2) */
  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: "safeAddress must be a valid Ethereum address (0x + 40 hex chars)",
  })
  safeAddress?: string;

  /** 0 = EOA, 1 = gnosis safe, 2 = magic link */
  @IsInt()
  @Min(0)
  @Max(2)
  sigType!: number;
}
