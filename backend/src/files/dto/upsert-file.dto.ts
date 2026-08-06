import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpsertFileDto {
  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9+/]{16}$/, {
    message: 'iv must be base64 of a 12-byte GCM nonce',
  })
  iv!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9+/]{24}$/, {
    message: 'authTag must be base64 of a 16-byte GCM tag',
  })
  authTag!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9+/=]+$/, {
    message: 'data must be base64 ciphertext',
  })
  data!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  baseVersion?: number;
}
