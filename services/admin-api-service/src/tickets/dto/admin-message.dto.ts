import { IsString, MaxLength, MinLength } from "class-validator";

export class AdminMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  declare body: string;
}
