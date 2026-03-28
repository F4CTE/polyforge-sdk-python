import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  IsObject,
  ValidateNested,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";

export class MarketSlotDto {
  @IsString()
  slot!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  defaultMarketId?: string;
}

export class StrategyVariableDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message:
      "Variable name must be a valid identifier (alphanumeric + underscore, no spaces)",
  })
  name!: string;

  @IsString()
  @MaxLength(200)
  expression!: string;
}

export class BlockDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(100)
  declare type: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  // SECURITY: Validated at runtime in strategy-engine before generating OrderIntents.
  // Action blocks enforce: size > 0 && size <= 10000, price between 0.001-0.999,
  // tokenId must be a non-empty string. See strategy-runner.ts validateBlockConfig().
}

export class CreateStrategyDto {
  @IsString()
  @MaxLength(100)
  declare name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(["PRIVATE", "PUBLIC", "UNLISTED"])
  visibility?: string = "PRIVATE";

  @IsOptional()
  @IsIn(["TICK", "EVENT", "HYBRID"])
  execMode?: string = "TICK";

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(60000)
  tickMs?: number = 1000;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  triggers?: BlockDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  conditions?: BlockDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  actions?: BlockDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  safety?: BlockDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StrategyVariableDto)
  variables?: StrategyVariableDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  logicBlocks?: BlockDto[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  calcBlocks?: BlockDto[] = [];

  @IsOptional()
  @IsObject()
  canvas?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketSlotDto)
  marketSlots?: MarketSlotDto[];
}
