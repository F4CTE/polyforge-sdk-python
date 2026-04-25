import {
  IsString,
  IsNotEmpty,
  IsUUID,
  MaxLength,
  Matches,
} from "class-validator";

export class ImportUsCredentialsDto {
  @IsUUID()
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
