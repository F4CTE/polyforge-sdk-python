import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ArrayMinSize,
} from "class-validator";

export class UpdateVenuePreferencesDto {
  @IsOptional()
  @IsString()
  defaultVenue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  enabledVenues?: string[];

  @IsOptional()
  @IsBoolean()
  singlePlatformMode?: boolean;
}
