import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";

export class ImportCredentialsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  /** Polymarket EOA private key as ASCII hex bytes (0x-prefixed). */
  @IsArray()
  @ArrayMinSize(66)
  @ArrayMaxSize(66)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(255, { each: true })
  privateKey!: number[];

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
