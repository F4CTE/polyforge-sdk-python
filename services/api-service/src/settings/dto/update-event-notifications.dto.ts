import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class EventPrefDto {
  @IsString() event!: string;
  @IsOptional() inApp?: boolean;
  @IsOptional() email?: boolean;
  @IsOptional() push?: boolean;
}

export class UpdateEventNotificationsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventPrefDto)
  preferences?: EventPrefDto[];

  @IsOptional()
  @IsString()
  emailDigest?: string;
}
