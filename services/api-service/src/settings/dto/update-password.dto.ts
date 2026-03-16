import { IsString, MinLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
    @IsString()
    declare currentPassword: string;

    @IsString()
    @MinLength(8)
    @Matches(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, {
        message: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 digit',
    })
    declare newPassword: string;
}
