import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    declare currentPassword: string;

    @IsString()
    @MinLength(8)
    @Matches(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, {
        message: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 digit',
    })
    declare newPassword: string;
}
