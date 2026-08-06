import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateVaultDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'keyFingerprint must be a 64-char hex SHA-256 digest',
  })
  keyFingerprint!: string;
}
