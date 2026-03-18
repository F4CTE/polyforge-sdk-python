import { IsEmail, MaxLength } from 'class-validator';

export class JoinWaitlistDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
