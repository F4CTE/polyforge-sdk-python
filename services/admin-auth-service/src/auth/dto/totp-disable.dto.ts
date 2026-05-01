import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class TotpDisableDto {
  @ApiProperty({
    description:
      "Current admin password — required for re-authentication when disabling 2FA",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({
    example: "123456",
    description: "6-digit TOTP code from the authenticator app",
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: "totpCode must be a 6-digit number" })
  totpCode: string;
}
