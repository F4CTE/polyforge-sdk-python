import { IsOptional, IsIn } from "class-validator";
import { PaginationDto } from "../../common/dto/pagination.dto";

export class StrategyQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(["IDLE", "RUNNING", "PAUSED", "PAPER"])
  status?: string;

  // R5-08: Allowlist for sort parameter to prevent arbitrary column access
  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "name", "status", "likeCount"])
  sort?: string = "createdAt";
}
