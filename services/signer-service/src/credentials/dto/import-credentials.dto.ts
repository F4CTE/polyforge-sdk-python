import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';

export class ImportCredentialsDto {
    @IsString()
    @IsNotEmpty()
    userId!: string;

    /** Polymarket EOA private key (hex, 0x-prefixed) */
    @IsString()
    @IsNotEmpty()
    privateKey!: string;

    /** L2 API key */
    @IsString()
    @IsNotEmpty()
    apiKey!: string;

    /** L2 API secret */
    @IsString()
    @IsNotEmpty()
    apiSecret!: string;

    /** L2 API passphrase */
    @IsString()
    @IsNotEmpty()
    apiPassphrase!: string;

    /** Safe address (only for sig_type 2) */
    @IsString()
    @IsOptional()
    safeAddress?: string;

    /** 0 = EOA, 1 = gnosis safe, 2 = magic link */
    @IsInt()
    @Min(0)
    @Max(2)
    sigType!: number;
}
