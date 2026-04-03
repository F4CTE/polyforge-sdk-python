import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsOptional,
} from "class-validator";

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];
}
