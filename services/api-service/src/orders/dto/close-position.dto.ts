import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class ClosePositionDto {
    @IsString()
    declare tokenId: string;

    @IsOptional()
    @IsNumberString()
    size?: string;
}
