import { IsString, MinLength, MaxLength } from "class-validator";

export class AiQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  declare query: string;
}
