import { IsString, IsIn, IsOptional, IsArray, IsObject } from 'class-validator';

export class BroadcastDto {
    @IsString()
    @IsIn(['EMAIL', 'TELEGRAM', 'DISCORD', 'IN_APP'])
    channel: string;

    @IsString()
    templateId: string;

    @IsString()
    subject: string;

    @IsOptional()
    @IsArray()
    userIds?: string[] | null;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
