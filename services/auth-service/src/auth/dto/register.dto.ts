import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  Equals,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alice@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Passw0rd!', minLength: 8, maxLength: 100 })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;

  @ApiProperty({
    example: 'alice_trades',
    description:
      '3–30 chars, alphanumeric + underscores, no leading/trailing underscore',
  })
  @IsString()
  @Matches(/^(?!_)[a-zA-Z0-9_]{3,30}(?<!_)$/, {
    message:
      'Username must be 3–30 characters, alphanumeric and underscores only, no leading or trailing underscore',
  })
  username: string;

  @ApiProperty({
    example: true,
    description: 'Must be true to accept the Terms of Service',
  })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the terms of service' })
  tosAccepted: boolean;

  @ApiPropertyOptional({
    example: 'POLY-ABC123',
    description: 'Invite code — required when INVITE_ONLY=true',
  })
  @IsOptional()
  @IsString()
  @Matches(/^POLY-[A-Z0-9]{6}$/, {
    message: 'inviteCode must be in the format POLY-XXXXXX',
  })
  inviteCode?: string;
}
