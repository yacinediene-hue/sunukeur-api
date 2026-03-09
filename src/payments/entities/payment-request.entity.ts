import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { Currency } from '../enums/currency.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentAttachment } from './payment-attachment.entity';

/** Seuil en XOF au-delà duquel un OTP est exigé avant paiement. */
export const OTP_THRESHOLD_XOF = 500_000;

@Entity('payment_requests')
export class PaymentRequest {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Données financières ──────────────────────────────────

  @ApiProperty({ description: 'Montant demandé', example: 750000 })
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: number;

  @ApiProperty({ enum: Currency, example: Currency.XOF })
  @Column({ type: 'enum', enum: Currency, default: Currency.XOF })
  devise: Currency;

  @ApiProperty({ description: 'Objet / motif de la demande' })
  @Column({ type: 'text' })
  description: string;

  // ── Statut ───────────────────────────────────────────────

  @ApiProperty({ enum: PaymentStatus, default: PaymentStatus.SOUMIS })
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.SOUMIS,
  })
  statut: PaymentStatus;

  // ── Acteurs ──────────────────────────────────────────────

  /** Prestataire qui soumet la demande */
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prestataireId' })
  prestataire: User;

  @Column()
  prestataireId: string;

  /** Analyste qui effectue la première validation */
  @ApiPropertyOptional()
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'analysteId' })
  analyste: User | null;

  @Column({ nullable: true })
  analysteId: string | null;

  /** Client qui effectue la validation finale */
  @ApiPropertyOptional()
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: User | null;

  @Column({ nullable: true })
  clientId: string | null;

  // ── Pièces justificatives ────────────────────────────────

  @ApiProperty({ type: () => [PaymentAttachment] })
  @OneToMany(() => PaymentAttachment, (a) => a.paymentRequest, {
    cascade: true,
    eager: true,
  })
  attachments: PaymentAttachment[];

  // ── Commentaires / motif ─────────────────────────────────

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  commentaireAnalyste: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  commentaireClient: string | null;

  @ApiPropertyOptional({ description: 'Motif de rejet (analyste ou client)' })
  @Column({ type: 'text', nullable: true })
  motifRejet: string | null;

  // ── Méthode de paiement ──────────────────────────────────

  @ApiPropertyOptional({ enum: PaymentMethod })
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  methodePaiement: PaymentMethod | null;

  @ApiPropertyOptional({
    description: 'Numéro de téléphone (mobile money) ou IBAN (virement)',
  })
  @Column({ length: 100, nullable: true })
  compteDestinataire: string | null;

  @ApiPropertyOptional({ description: 'ID de transaction PayDunya' })
  @Column({ length: 100, nullable: true })
  transactionId: string | null;

  // ── OTP ──────────────────────────────────────────────────

  /** Stocké haché en prod ; ici en clair pour la démo */
  @Column({ length: 10, nullable: true, select: false })
  otpCode: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  otpExpiresAt: Date | null;

  @Column({ default: false })
  otpVerified: boolean;

  // ── Horodatages métier ───────────────────────────────────

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  analysedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ── Helpers ──────────────────────────────────────────────

  get requiresOtp(): boolean {
    return this.devise === Currency.XOF && Number(this.montant) > OTP_THRESHOLD_XOF;
  }
}
