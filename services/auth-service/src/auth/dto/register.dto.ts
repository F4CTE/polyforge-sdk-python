import { IsEmail, IsString, MinLength, MaxLength, Matches, IsBoolean, Equals } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    @MaxLength(255)
    email: string;

    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    })
    password: string;

    @IsString()
    @Matches(/^(?!_)[a-zA-Z0-9_]{3,30}(?<!_)$/, {
        message: 'Username must be 3–30 characters, alphanumeric and underscores only, no leading or trailing underscore',
    })
    username: string;

    @IsBoolean()
    @Equals(true, { message: 'You must accept the terms of service' })
    tosAccepted: boolean;
}
