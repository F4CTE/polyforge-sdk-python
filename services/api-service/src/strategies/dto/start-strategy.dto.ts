import { IsIn } from 'class-validator';

export class StartStrategyDto {
    @IsIn(['live', 'paper'])
    declare mode: 'live' | 'paper';
}
