import { IsEnum, IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { AdminRole } from '@polyforge/shared-types';

export class UpdateAdminDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    displayName?: string;

    @IsOptional()
    @IsEnum(AdminRole)
    role?: AdminRole;

    @IsOptional()
    @IsBoolean()
    active?: boolean;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @MaxLength(100)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/, {
        message: 'password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
    })
    password?: string;
}
