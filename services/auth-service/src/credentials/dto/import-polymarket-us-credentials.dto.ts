import {
  Equals,
  IsBoolean,
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CURRENT_US_RAIL_TERMS_VERSION } from '@polyforge/shared-types';

export class ImportPolymarketUsCredentialsDto {
  @ApiProperty({
    example: 'abcdef12-1234-5678-abcd-1234567890ab',
    description:
      'Polymarket US API key ID (plaintext identifier from polymarket.us/developer)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  keyId!: string;

  @ApiProperty({
    example: 'a1b2c3d4e5f6' + '0'.repeat(52),
    description:
      'Ed25519 secret key — 64-character hex string (32-byte seed) from polymarket.us/developer',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message:
      'secretKey must be a 64-character hex string (32-byte Ed25519 seed)',
  })
  secretKey!: string;

  @ApiProperty({
    example: true,
    description: 'Explicit user acceptance of the current US-rail legal terms.',
  })
  @IsBoolean()
  @Equals(true, { message: 'US-rail terms must be accepted' })
  usRailTermsAccepted!: boolean;

  @ApiProperty({
    example: CURRENT_US_RAIL_TERMS_VERSION,
    description: 'US-rail legal terms version accepted by the user.',
  })
  @IsString()
  @Equals(CURRENT_US_RAIL_TERMS_VERSION, {
    message: 'US-rail terms version is stale',
  })
  usRailTermsVersion!: string;
}
