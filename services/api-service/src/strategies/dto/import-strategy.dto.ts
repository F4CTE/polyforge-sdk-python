import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsInt,
  IsObject,
  ValidateNested,
  ArrayMaxSize,
  MaxLength,
  Min,
  Max,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

class ImportVariableDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: "Variable name must be a valid identifier",
  })
  name!: string;

  @IsString()
  @MaxLength(200)
  expression!: string;
}

class ImportBlockDto {
  @IsString()
  @MaxLength(100)
  declare type: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class ImportBlocksDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportBlockDto)
  safety?: ImportBlockDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportBlockDto)
  triggers?: ImportBlockDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportBlockDto)
  conditions?: ImportBlockDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ImportBlockDto)
  actions?: ImportBlockDto[];
}

class ImportCanvasDto {
  @IsOptional()
  @IsObject()
  positions?: Record<string, { x: number; y: number }>;

  @IsOptional()
  @IsArray()
  connections?: { from: string; to: string }[];
}

class ImportStrategyPayloadDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(["TICK", "EVENT", "HYBRID"])
  execMode?: string;

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(60000)
  tickMs?: number;

  @IsOptional()
  @IsIn(["PRIVATE", "PUBLIC", "UNLISTED"])
  visibility?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ImportVariableDto)
  variables?: ImportVariableDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportBlocksDto)
  blocks?: ImportBlocksDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImportCanvasDto)
  canvas?: ImportCanvasDto;
}

export class ImportStrategyDto {
  @IsString()
  polyforge!: string;

  @IsOptional()
  @IsString()
  exportedAt?: string;

  @ValidateNested()
  @Type(() => ImportStrategyPayloadDto)
  strategy!: ImportStrategyPayloadDto;
}
