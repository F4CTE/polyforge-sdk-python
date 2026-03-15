import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: 'a3f8...hex64chars', minLength: 64, maxLength: 64, description: '64-character hex reset token from email link' })
    @IsString()
    @Length(64, 64, { message: 'Token must be a 64-character hex string' })
    token: string;

    @ApiProperty({ example: 'NewPassw0rd!', minLength: 8 })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    })
    newPassword: string;
}
