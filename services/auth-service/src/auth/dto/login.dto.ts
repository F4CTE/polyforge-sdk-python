import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'alice@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Passw0rd!' })
    @IsString()
    @MinLength(1)
    password: string;

    @ApiPropertyOptional({ example: '123456', description: '6-digit TOTP code (required if 2FA is enabled)' })
    @IsOptional()
    @IsString()
    totpCode?: string;
}
