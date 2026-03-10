import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';
import { ProjectStatus } from '../../common/enums/project-status.enum';

export class AdminStatsDto {
  @ApiProperty({ description: 'Nombre total de projets' })
  totalProjects: number;

  @ApiProperty({ description: 'Nombre de projets actifs (EN_COURS)' })
  activeProjects: number;

  @ApiProperty({ description: 'Nombre de projets terminés' })
  completedProjects: number;

  @ApiProperty({ description: 'Total financé (paiements PAYE) en XOF' })
  totalFunded: number;

  @ApiProperty({ description: 'Nombre de demandes de paiement en attente (SOUMIS + EN_ANALYSE)' })
  pendingPayments: number;

  @ApiProperty({ description: 'Montant total des paiements en attente en XOF' })
  pendingAmount: number;

  @ApiProperty({ description: 'Taux de complétion moyen des jalons en %' })
  avgCompletionRate: number;
}

export class PaymentAlertDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  montant: number;

  @ApiProperty()
  devise: string;

  @ApiProperty({ enum: PaymentStatus })
  statut: PaymentStatus;

  @ApiProperty()
  description: string;

  @ApiProperty({ description: 'Nom complet du prestataire' })
  prestataire: string;

  @ApiProperty()
  createdAt: Date;
}

export class AdminProjectSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty({ description: 'Nom complet du client' })
  client: string;

  @ApiProperty()
  milestoneTotal: number;

  @ApiProperty()
  milestoneCompleted: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  createdAt: Date;
}

export class AdminTransactionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  montant: number;

  @ApiProperty()
  devise: string;

  @ApiProperty({ enum: PaymentStatus })
  statut: PaymentStatus;

  @ApiProperty()
  prestataire: string;

  @ApiProperty({ nullable: true })
  projectDescription: string | null;

  @ApiProperty({ nullable: true })
  paidAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class AdminDashboardDto {
  @ApiProperty({ type: AdminStatsDto })
  stats: AdminStatsDto;

  @ApiProperty({ type: [PaymentAlertDto], description: 'Paiements en attente de traitement' })
  pendingPaymentAlerts: PaymentAlertDto[];

  @ApiProperty({ type: [AdminProjectSummaryDto] })
  projects: AdminProjectSummaryDto[];

  @ApiProperty({ type: [AdminTransactionSummaryDto] })
  recentTransactions: AdminTransactionSummaryDto[];
}
