import {
  IsArray,
  IsString,
  IsIn,
  IsOptional,
  IsObject,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

export class BatchItemDto {
  @IsString()
  @MaxLength(64)
  declare id: string;

  @IsIn(["GET", "POST", "PATCH", "DELETE"])
  declare method: "GET" | "POST" | "PATCH" | "DELETE";

  @IsString()
  @MaxLength(500)
  declare path: string;

  @IsOptional()
  @IsObject()
  body?: any;
}

export class BatchRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BatchItemDto)
  declare items: BatchItemDto[];
}

export interface BatchResponseItem {
  id: string;
  status: number;
  body: any;
}
