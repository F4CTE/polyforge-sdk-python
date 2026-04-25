import { IsString, IsOptional, IsIn, MaxLength } from "class-validator";

export const ORDER_MOODS = [
  "CONFIDENT",
  "UNCERTAIN",
  "FOMO",
  "DISCIPLINED",
  "REVENGE",
] as const;

export type OrderMood = (typeof ORDER_MOODS)[number];

export class UpdateOrderJournalDto {
  @IsString()
  @IsIn(ORDER_MOODS)
  mood!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
