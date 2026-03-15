import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
    @ApiProperty({ example: 'a3f8...hex64chars', minLength: 64, maxLength: 64, description: '64-character hex verification token from email link' })
    @IsString()
    @Length(64, 64, { message: 'Token must be a 64-character hex string' })
    token: string;
}
