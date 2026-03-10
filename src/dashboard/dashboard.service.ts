import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Milestone } from '../projects/entities/milestone.entity';
import { PaymentRequest } from '../payments/entities/payment-request.entity';
import { ProjectStatus } from '../common/enums/project-status.enum';
import { MilestoneStatus } from '../common/enums/milestone-status.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import {
  ClientDashboardDto,
  ClientProjectSummaryDto,
  MilestoneProgressDto,
} from './dto/client-dashboard.dto';
import {
  AdminDashboardDto,
  AdminProjectSummaryDto,
  AdminTransactionSummaryDto,
  PaymentAlertDto,
} from './dto/admin-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(PaymentRequest)
    private readonly paymentRepo: Repository<PaymentRequest>,
  ) {}

  // ── Client dashboard ──────────────────────────────────────

  async getClientDashboard(userId: string): Promise<ClientDashboardDto> {
    const projects = await this.projectRepo.find({
      where: { clientId: userId },
      relations: ['milestones'],
      order: { createdAt: 'DESC' },
    });

    // Fetch all PAYE payments for this client
    const paidPayments = await this.paymentRepo.find({
      where: { clientId: userId, statut: PaymentStatus.PAYE },
    });

    const totalFundedMap = new Map<string, number>();
    for (const p of paidPayments) {
      // payments are associated with client, accumulate per projectId via description match
      // We sum by client globally here; project-level breakdown uses prestataire link
    }
    const totalFunded = paidPayments.reduce((sum, p) => sum + Number(p.montant), 0);

    const projectSummaries: ClientProjectSummaryDto[] = projects.map((project) => {
      const milestoneProgress = this.computeMilestoneProgress(project.milestones ?? []);
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        totalBudget: Number(project.totalBudget),
        totalFunded: 0, // payment<>project link not modelled; show 0 or total client funded
        milestoneProgress,
        createdAt: project.createdAt,
      };
    });

    const activeProjects = projects.filter((p) => p.status === ProjectStatus.EN_COURS).length;
    const allRates = projectSummaries.map((p) => p.milestoneProgress.rate);
    const avgCompletionRate =
      allRates.length > 0
        ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length * 10) / 10
        : 0;

    return {
      stats: {
        totalProjects: projects.length,
        activeProjects,
        totalFunded,
        avgCompletionRate,
      },
      projects: projectSummaries,
    };
  }

  // ── Admin dashboard ───────────────────────────────────────

  async getAdminDashboard(): Promise<AdminDashboardDto> {
    const [projects, allPayments] = await Promise.all([
      this.projectRepo.find({
        relations: ['milestones', 'client'],
        order: { createdAt: 'DESC' },
      }),
      this.paymentRepo.find({
        relations: ['prestataire'],
        order: { createdAt: 'DESC' },
      }),
    ]);

    // ── Stats ───────────────────────────────────────────────
    const activeProjects = projects.filter((p) => p.status === ProjectStatus.EN_COURS).length;
    const completedProjects = projects.filter((p) => p.status === ProjectStatus.TERMINE).length;

    const paidPayments = allPayments.filter((p) => p.statut === PaymentStatus.PAYE);
    const totalFunded = paidPayments.reduce((sum, p) => sum + Number(p.montant), 0);

    const pendingPayments = allPayments.filter(
      (p) => p.statut === PaymentStatus.SOUMIS || p.statut === PaymentStatus.EN_ANALYSE,
    );
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.montant), 0);

    const allRates = projects.map((p) => this.computeMilestoneProgress(p.milestones ?? []).rate);
    const avgCompletionRate =
      allRates.length > 0
        ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length * 10) / 10
        : 0;

    // ── Pending payment alerts ──────────────────────────────
    const pendingPaymentAlerts: PaymentAlertDto[] = pendingPayments.map((p) => ({
      id: p.id,
      montant: Number(p.montant),
      devise: p.devise,
      statut: p.statut,
      description: p.description,
      prestataire: p.prestataire ? `${p.prestataire.firstName} ${p.prestataire.lastName}` : '—',
      createdAt: p.createdAt,
    }));

    // ── Project summaries ───────────────────────────────────
    const projectSummaries: AdminProjectSummaryDto[] = projects.map((project) => {
      const progress = this.computeMilestoneProgress(project.milestones ?? []);
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        totalBudget: Number(project.totalBudget),
        client: project.client ? `${project.client.firstName} ${project.client.lastName}` : '—',
        milestoneTotal: progress.total,
        milestoneCompleted: progress.completed,
        completionRate: progress.rate,
        createdAt: project.createdAt,
      };
    });

    // ── Recent transactions (last 20) ───────────────────────
    const recentTransactions: AdminTransactionSummaryDto[] = allPayments
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        montant: Number(p.montant),
        devise: p.devise,
        statut: p.statut,
        prestataire: p.prestataire ? `${p.prestataire.firstName} ${p.prestataire.lastName}` : '—',
        projectDescription: p.description,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      }));

    return {
      stats: {
        totalProjects: projects.length,
        activeProjects,
        completedProjects,
        totalFunded,
        pendingPayments: pendingPayments.length,
        pendingAmount,
        avgCompletionRate,
      },
      pendingPaymentAlerts,
      projects: projectSummaries,
      recentTransactions,
    };
  }

  // ── Private helpers ───────────────────────────────────────

  private computeMilestoneProgress(milestones: Milestone[]): MilestoneProgressDto {
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === MilestoneStatus.TERMINE).length;
    const rate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    return { total, completed, rate };
  }
}
