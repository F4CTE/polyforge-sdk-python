import { IsString, IsNotEmpty, MaxLength, Matches } from "class-validator";

export class ImportUsCredentialsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  keyId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: "secretKey must be a 64-char hex string (32-byte Ed25519 seed)",
  })
  secretKey!: string;
}
