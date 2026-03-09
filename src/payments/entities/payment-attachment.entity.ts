import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequest } from './payment-request.entity';

@Entity('payment_attachments')
export class PaymentAttachment {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nom original du fichier' })
  @Column({ length: 255 })
  fileName: string;

  @ApiProperty({ description: 'URL de stockage du fichier' })
  @Column({ type: 'text' })
  fileUrl: string;

  @ApiProperty({ description: 'Type MIME (application/pdf, image/jpeg…)' })
  @Column({ length: 100 })
  mimeType: string;

  @ApiProperty({ description: 'Taille en octets' })
  @Column({ type: 'bigint' })
  fileSize: number;

  @ManyToOne(() => PaymentRequest, (pr) => pr.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'paymentRequestId' })
  paymentRequest: PaymentRequest;

  @Column()
  paymentRequestId: string;

  @CreateDateColumn()
  createdAt: Date;
}
