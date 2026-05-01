import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class ManualMarketMatchDto {
  @ApiProperty({
    description: "Polymarket market ID",
    example: "0x1234abcd...",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  polymarketId: string;

  @ApiProperty({
    description: "Kalshi market ticker / ID",
    example: "PRES-2024-DJT",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  kalshiId: string;
}
