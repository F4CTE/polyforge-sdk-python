import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from "class-validator";
import { PlaceOrderDto } from "./place-order.dto";

export class BatchPlaceOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => PlaceOrderDto)
  orders!: PlaceOrderDto[];
}

export class BulkCancelDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3000)
  @IsString({ each: true })
  orderIds!: string[];
}
