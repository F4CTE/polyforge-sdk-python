import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
    @IsString()
    @Length(64, 64, { message: 'Token must be a 64-character hex string' })
    token: string;
}
