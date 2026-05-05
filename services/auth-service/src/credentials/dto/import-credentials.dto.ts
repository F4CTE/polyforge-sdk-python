import {
  IsString,
  IsInt,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportCredentialsDto {
  @ApiProperty({
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
    description: 'Polymarket wallet address (EIP-55 checksummed)',
  })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress!: string;

  @ApiProperty({
    example: '0xprivatekey...',
    description: 'Polymarket private key (hex, 0x-prefixed)',
  })
  @IsString()
  @MinLength(64)
  @MaxLength(132)
  privateKey!: string;

  @ApiProperty({
    example: 1,
    description:
      'Signature type (0 = EOA, 1 = POLY_PROXY (Magic Link), 2 = GNOSIS_SAFE (MetaMask/Privy))',
  })
  @IsInt()
  @IsIn([0, 1, 2])
  sigType!: number;

  @ApiPropertyOptional({
    example: 'api-key-value',
    description: 'CLOB API key (required for sigType 0)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({
    example: 'api-secret-value',
    description: 'CLOB API secret',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiSecret?: string;

  @ApiPropertyOptional({
    example: 'api-passphrase-value',
    description: 'CLOB API passphrase',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiPassphrase?: string;

  @ApiPropertyOptional({
    example: '0xabcdef1234567890abcdef1234567890abcdef12',
    description: 'Safe address (required for Gnosis Safe signature type)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: 'safeAddress must be a valid Ethereum address',
  })
  safeAddress?: string;
}
