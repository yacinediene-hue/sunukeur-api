import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { PaymentMethod } from '../enums/payment-method.enum';

export class DisbursePaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  methodePaiement: PaymentMethod;

  @ApiProperty({
    description:
      'Numéro de téléphone (Orange Money/Wave/Free Money) ou IBAN (virement)',
    example: '+221771234567',
  })
  @IsString()
  @MinLength(7)
  compteDestinataire: string;
}
