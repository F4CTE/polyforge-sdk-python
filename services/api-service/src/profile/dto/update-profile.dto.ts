import { IsString, IsOptional, MaxLength, IsUrl } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsUrl()
  @IsOptional()
  @MaxLength(2048)
  avatarUrl?: string;
}
