import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min, Max } from "class-validator";

export class GenerateInvitesDto {
  @ApiPropertyOptional({
    example: 10,
    description: "Number of codes to generate (default 1)",
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "How many times each code can be used (default 1)",
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  uses?: number;

  @ApiPropertyOptional({
    example: 7,
    description: "TTL in days — omit for no expiry",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  ttlDays?: number;
}
