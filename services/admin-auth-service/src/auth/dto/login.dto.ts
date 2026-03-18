import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

export class AdminLoginDto {
  @ApiProperty({ example: "admin@polyforge.app" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "AdminPassw0rd!" })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
