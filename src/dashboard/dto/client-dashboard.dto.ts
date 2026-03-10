import { ApiProperty } from '@nestjs/swagger';
import { ProjectStatus } from '../../common/enums/project-status.enum';

export class MilestoneProgressDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  completed: number;

  @ApiProperty({ description: 'Taux de complétion en %', example: 66.7 })
  rate: number;
}

export class ClientProjectSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty()
  totalBudget: number;

  @ApiProperty({ description: 'Montant total des paiements effectués (PAYE)' })
  totalFunded: number;

  @ApiProperty()
  milestoneProgress: MilestoneProgressDto;

  @ApiProperty()
  createdAt: Date;
}

export class ClientStatsDto {
  @ApiProperty({ description: 'Nombre de projets actifs (EN_COURS)' })
  activeProjects: number;

  @ApiProperty({ description: 'Nombre total de projets' })
  totalProjects: number;

  @ApiProperty({ description: 'Total financé (tous projets confondus) en XOF' })
  totalFunded: number;

  @ApiProperty({ description: 'Taux de complétion moyen des jalons en %' })
  avgCompletionRate: number;
}

export class ClientDashboardDto {
  @ApiProperty({ type: ClientStatsDto })
  stats: ClientStatsDto;

  @ApiProperty({ type: [ClientProjectSummaryDto] })
  projects: ClientProjectSummaryDto[];
}
