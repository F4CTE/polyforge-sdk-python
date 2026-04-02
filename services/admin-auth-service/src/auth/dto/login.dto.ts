import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "admin@polyforge.app" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "AdminPassw0rd!" })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({
    example: "123456",
    description: "TOTP code (required if 2FA is enabled)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "totpCode must be a 6-digit number" })
  totpCode?: string;
}
