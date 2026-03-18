import { IsString, IsIn, IsOptional, IsArray, IsObject, MaxLength, ArrayMaxSize, IsUUID } from 'class-validator';

export class BroadcastDto {
    @IsString()
    @IsIn(['EMAIL', 'TELEGRAM', 'DISCORD', 'IN_APP'])
    channel: string;

    @IsString()
    @MaxLength(255)
    templateId: string;

    @IsString()
    @MaxLength(255)
    subject: string;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10000)
    @IsUUID('4', { each: true })
    userIds?: string[] | null;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
