import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  venueOrderId!: string;
}
