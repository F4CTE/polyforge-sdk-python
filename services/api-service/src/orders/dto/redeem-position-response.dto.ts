import { ApiProperty } from "@nestjs/swagger";

export class RedeemPositionResponseDto {
  @ApiProperty({ description: "ID of the redeemed position", format: "uuid" })
  positionId!: string;

  @ApiProperty({
    description: "Redemption intent ID published to the stream",
    format: "uuid",
  })
  intentId!: string;

  @ApiProperty({
    description: "Position status after redemption",
    enum: ["REDEEMED"],
    example: "REDEEMED",
  })
  status!: "REDEEMED";
}
