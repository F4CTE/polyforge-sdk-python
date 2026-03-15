import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@polyforge.app' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'AdminPassw0rd!' })
  @IsString()
  @MinLength(1)
  password: string;
}
