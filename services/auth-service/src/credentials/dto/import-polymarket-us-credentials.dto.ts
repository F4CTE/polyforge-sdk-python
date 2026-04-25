import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    message: 'secretKey must be a 64-character hex string (32-byte Ed25519 seed)',
  })
  secretKey!: string;
}
