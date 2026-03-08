import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Milestone } from './entities/milestone.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { MilestoneStatus } from '../common/enums/milestone-status.enum';
import { MilestoneType } from '../common/enums/milestone-type.enum';
import { ProjectStatus } from '../common/enums/project-status.enum';

const PREDEFINED_MILESTONES: Array<{
  type: MilestoneType;
  label: string;
  order: number;
}> = [
  { type: MilestoneType.FONDATION, label: 'Fondation', order: 1 },
  { type: MilestoneType.ELEVATION, label: 'Élévation', order: 2 },
  { type: MilestoneType.TOITURE, label: 'Toiture', order: 3 },
  { type: MilestoneType.FINITIONS, label: 'Finitions', order: 4 },
];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Milestone)
    private readonly milestoneRepo: Repository<Milestone>,
  ) {}

  async create(dto: CreateProjectDto, client: User): Promise<Project> {
    const project = this.projectRepo.create({
      ...dto,
      clientId: client.id,
      status: ProjectStatus.BROUILLON,
    });

    const saved = await this.projectRepo.save(project);

    // Création automatique des 4 jalons prédéfinis
    const milestones = PREDEFINED_MILESTONES.map((m) =>
      this.milestoneRepo.create({
        ...m,
        projectId: saved.id,
        status: MilestoneStatus.EN_ATTENTE,
        startedAt: null,
        completedAt: null,
        notes: null,
      }),
    );

    await this.milestoneRepo.save(milestones);

    return this.findOne(saved.id, client);
  }

  async findAll(user: User): Promise<Project[]> {
    const qb = this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.client', 'client')
      .leftJoinAndSelect('project.milestones', 'milestones')
      .orderBy('project.createdAt', 'DESC')
      .addOrderBy('milestones.order', 'ASC');

    // Client : uniquement ses propres projets
    if (user.role === Role.CLIENT) {
      qb.where('project.clientId = :clientId', { clientId: user.id });
    }

    return qb.getMany();
  }

  async findOne(id: string, user?: User): Promise<Project> {
    const project = await this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.client', 'client')
      .leftJoinAndSelect('project.milestones', 'milestones')
      .where('project.id = :id', { id })
      .orderBy('milestones.order', 'ASC')
      .getOne();

    if (!project) {
      throw new NotFoundException(`Projet #${id} introuvable`);
    }

    this.assertAccess(project, user);

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, user: User): Promise<Project> {
    const project = await this.findOne(id, user);

    // Seul le client propriétaire ou un admin peut modifier
    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres projets');
    }

    Object.assign(project, dto);
    await this.projectRepo.save(project);

    return this.findOne(id, user);
  }

  async remove(id: string, user: User): Promise<void> {
    const project = await this.findOne(id, user);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres projets');
    }

    await this.projectRepo.remove(project);
  }

  async updateMilestoneStatus(
    projectId: string,
    milestoneId: string,
    dto: UpdateMilestoneStatusDto,
    user: User,
  ): Promise<Milestone> {
    const project = await this.findOne(projectId, user);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      throw new ForbiddenException('Accès refusé à ce projet');
    }

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new NotFoundException(`Jalon #${milestoneId} introuvable dans ce projet`);
    }

    // Mise à jour des timestamps selon le nouveau statut
    if (dto.status === MilestoneStatus.EN_COURS && !milestone.startedAt) {
      milestone.startedAt = new Date();
      milestone.completedAt = null;
    } else if (dto.status === MilestoneStatus.TERMINE) {
      milestone.completedAt = new Date();
      if (!milestone.startedAt) milestone.startedAt = new Date();
    } else if (dto.status === MilestoneStatus.EN_ATTENTE) {
      milestone.startedAt = null;
      milestone.completedAt = null;
    }

    milestone.status = dto.status;
    if (dto.notes !== undefined) milestone.notes = dto.notes;

    return this.milestoneRepo.save(milestone);
  }

  // --- Helpers ---

  private assertAccess(project: Project, user?: User): void {
    if (!user) return;
    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      throw new ForbiddenException('Accès refusé à ce projet');
    }
  }
}
