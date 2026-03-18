import { IsString, IsIn, IsOptional, IsArray, IsObject, MaxLength } from 'class-validator';

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
    userIds?: string[] | null;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
