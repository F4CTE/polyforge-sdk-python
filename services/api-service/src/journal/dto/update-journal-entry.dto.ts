import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
} from "class-validator";

const MOODS = [
  "confident",
  "uncertain",
  "fomo",
  "disciplined",
  "neutral",
] as const;

export class UpdateJournalEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @IsIn(MOODS)
  mood?: string;
}
