import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";
import { AdminRole } from "@polyforge/shared-types";

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.{8,100}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).*$/, {
    message:
      "password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character",
  })
  password: string;

  @IsEnum(AdminRole)
  role: AdminRole;
}
