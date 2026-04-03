import { IsString, IsOptional, MaxLength } from "class-validator";

export class RejectUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
