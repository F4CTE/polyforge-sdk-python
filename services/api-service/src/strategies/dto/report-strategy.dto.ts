import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportStrategyDto {
    @IsIn(['SPAM', 'MISLEADING', 'HARMFUL', 'OTHER'])
    declare reason: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;
}
