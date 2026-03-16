import { IsString, IsNotEmpty, IsNumber, IsIn, IsOptional, Min } from 'class-validator';

export class SignOrderDto {
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    requestId!: string;

    /** Token ID (Polymarket condition ID + outcome index) */
    @IsString()
    @IsNotEmpty()
    tokenId!: string;

    @IsIn(['BUY', 'SELL'])
    side!: 'BUY' | 'SELL';

    /** Size in shares */
    @IsNumber()
    @Min(0)
    size!: number;

    /** Limit price (0–1) */
    @IsNumber()
    @Min(0)
    price!: number;

    @IsIn(['GTC', 'FOK', 'GTD'])
    orderType!: 'GTC' | 'FOK' | 'GTD';

    /** GTD expiry (Unix ms), required when orderType = GTD */
    @IsNumber()
    @IsOptional()
    expiration?: number;
}
