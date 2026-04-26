import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
  ArrayMaxSize,
} from "class-validator";

const MOODS = [
  "confident",
  "uncertain",
  "fomo",
  "disciplined",
  "neutral",
] as const;

export class CreateJournalEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @IsIn(MOODS)
  mood?: string;
}
