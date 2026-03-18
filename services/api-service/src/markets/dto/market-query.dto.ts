import { IsOptional, IsString, IsBoolean, IsIn, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class MarketQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    search?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    category?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    closed?: boolean;

    @IsOptional()
    @IsIn(['volume', 'endDate', 'firstSeenAt'])
    sort?: string = 'volume';
}

export class PriceHistoryQueryDto {
    @IsOptional()
    @IsIn(['1m', '1h', '1d'])
    resolution?: string = '1h';

    @IsOptional()
    @IsString()
    from?: string;

    @IsOptional()
    @IsString()
    to?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(1000)
    limit?: number = 200;
}
