import { IsString, MaxLength } from "class-validator";

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  declare content: string;
}
