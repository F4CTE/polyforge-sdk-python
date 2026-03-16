import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class ReviewReportDto {
    @IsString()
    @IsIn(['REVIEWED', 'DISMISSED'])
    status: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    adminNote?: string;
}
