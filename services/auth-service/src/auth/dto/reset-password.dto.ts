import { IsString, Length, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @Length(64, 64, { message: 'Token must be a 64-character hex string' })
    token: string;

    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    })
    newPassword: string;
}
