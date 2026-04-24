import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportKalshiCredentialsDto {
  @ApiProperty({
    example: 'usr_abc123',
    description: 'Kalshi user ID',
  })
  @IsString()
  @MaxLength(255)
  userId!: string;
}
