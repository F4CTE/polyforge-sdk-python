import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class StrategyQueryDto extends PaginationDto {
    @IsOptional()
    @IsIn(['IDLE', 'RUNNING', 'PAUSED', 'PAPER'])
    status?: string;

    @IsOptional()
    @IsIn(['createdAt', 'updatedAt'])
    sort?: string = 'createdAt';
}
