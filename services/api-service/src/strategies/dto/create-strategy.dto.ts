import {
    IsString, IsOptional, IsIn, IsArray, IsInt, IsBoolean,
    Min, Max, MaxLength, IsObject, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BlockDto {
    @IsString()
    @MaxLength(100)
    declare type: string;

    @IsOptional()
    @IsObject()
    config?: Record<string, unknown>;
}

export class CreateStrategyDto {
    @IsString()
    @MaxLength(100)
    declare name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsIn(['PRIVATE', 'PUBLIC', 'UNLISTED'])
    visibility?: string = 'PRIVATE';

    @IsOptional()
    @IsIn(['TICK', 'EVENT', 'HYBRID'])
    execMode?: string = 'TICK';

    @IsOptional()
    @IsInt()
    @Min(200)
    @Max(60000)
    tickMs?: number = 1000;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => BlockDto)
    triggers?: BlockDto[] = [];

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => BlockDto)
    conditions?: BlockDto[] = [];

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => BlockDto)
    actions?: BlockDto[] = [];

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => BlockDto)
    safety?: BlockDto[] = [];

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(50, { each: true })
    tags?: string[] = [];
}
