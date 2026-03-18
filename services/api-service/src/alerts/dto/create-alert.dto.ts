import { IsString, IsIn, IsNumberString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateAlertDto {
    @IsString()
    @MaxLength(255)
    declare tokenId: string;

    @IsIn(['above', 'below'])
    declare direction: 'above' | 'below';

    @IsNumberString()
    declare price: string;

    @IsOptional()
    @IsBoolean()
    persistent?: boolean = false;
}
