import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from '../enums/currency.enum';

export class AttachmentDto {
  @ApiProperty({ example: 'facture-001.pdf' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'URL accessible du fichier (stockage objet)' })
  @IsUrl()
  fileUrl: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(100)
  mimeType: string;

  @ApiProperty({ example: 204800, description: 'Taille en octets' })
  @IsNumber()
  @IsPositive()
  fileSize: number;
}

export class CreatePaymentRequestDto {
  @ApiProperty({ example: 750000, description: 'Montant de la demande' })
  @IsNumber()
  @IsPositive()
  montant: number;

  @ApiProperty({ enum: Currency, example: Currency.XOF })
  @IsEnum(Currency)
  devise: Currency;

  @ApiProperty({ example: 'Paiement phase 2 – coulage dalle', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({
    type: [AttachmentDto],
    description: 'Pièces justificatives (devis, factures…)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
