import { IsString, IsIn, IsNumberString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAlertDto {
    @IsString()
    declare tokenId: string;

    @IsIn(['above', 'below'])
    declare direction: 'above' | 'below';

    @IsNumberString()
    declare price: string;

    @IsOptional()
    @IsBoolean()
    persistent?: boolean = false;
}
