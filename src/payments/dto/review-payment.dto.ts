import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export enum ReviewAction {
  VALIDER = 'valider',
  REJETER = 'rejeter',
}

export class AnalysteReviewDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiPropertyOptional({ description: "Commentaire de l'analyste" })
  @IsOptional()
  @IsString()
  commentaire?: string;

  @ApiPropertyOptional({ description: 'Obligatoire si action = rejeter' })
  @ValidateIf((o) => o.action === ReviewAction.REJETER)
  @IsString()
  @MinLength(10)
  motifRejet?: string;
}

export class ClientReviewDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiPropertyOptional({ description: 'Commentaire du client' })
  @IsOptional()
  @IsString()
  commentaire?: string;

  @ApiPropertyOptional({ description: 'Obligatoire si action = rejeter' })
  @ValidateIf((o) => o.action === ReviewAction.REJETER)
  @IsString()
  @MinLength(10)
  motifRejet?: string;

  @ApiPropertyOptional({
    description:
      'OTP reçu par SMS — obligatoire pour les montants > 500 000 XOF',
    example: '847291',
  })
  @IsOptional()
  @IsString()
  otpCode?: string;
}
