import { IsString, Length, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TotpConfirmDto {
    @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app' })
    @IsString()
    @Length(6, 6)
    code!: string;
}

export class TotpDisableDto {
    @ApiProperty({ example: 'MySecurePassword1!', description: 'Current account password to confirm disable' })
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    password!: string;
}

export class TotpLoginDto {
    @ApiProperty({ example: '123456', description: '6-digit TOTP code or 8-character backup code' })
    @IsString()
    code!: string;
}
