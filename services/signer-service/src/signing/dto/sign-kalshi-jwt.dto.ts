import { IsString, IsNotEmpty } from "class-validator";

export class SignKalshiJwtDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  requestId!: string;
}
