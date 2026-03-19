import { IsOptional, IsIn, IsUUID } from "class-validator";

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(["OPEN", "AWAITING_USER", "AWAITING_ADMIN", "CLOSED"])
  status?: string;

  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
