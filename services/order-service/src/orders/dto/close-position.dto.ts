import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ClosePositionDto {
    @IsString()
    @IsNotEmpty()
    userId!: string;

    @IsString()
    @IsNotEmpty()
    tokenId!: string;

    @IsString()
    @IsNotEmpty()
    marketId!: string;

    /** Size to close (shares, decimal string) */
    @IsString()
    @IsNotEmpty()
    size!: string;

    @IsString()
    @IsOptional()
    strategyId?: string;
}
