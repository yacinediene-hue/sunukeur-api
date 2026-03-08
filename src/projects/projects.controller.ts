import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateMilestoneStatusDto } from './dto/update-milestone-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ── Projets ──────────────────────────────────────────────

  @Post()
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary: 'Créer un projet (client uniquement)',
    description:
      'Crée un projet et génère automatiquement les 4 jalons : Fondation, Élévation, Toiture, Finitions.',
  })
  @ApiResponse({ status: 201, description: 'Projet créé avec ses jalons' })
  create(@Body() dto: CreateProjectDto, @GetUser() user: User) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  @Roles(Role.CLIENT, Role.PRESTATAIRE, Role.ANALYSTE, Role.ADMIN)
  @ApiOperation({
    summary: 'Lister les projets',
    description:
      'Client : ses propres projets. Admin/Analyste/Prestataire : tous les projets.',
  })
  findAll(@GetUser() user: User) {
    return this.projectsService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.PRESTATAIRE, Role.ANALYSTE, Role.ADMIN)
  @ApiOperation({ summary: 'Récupérer un projet par ID' })
  @ApiResponse({ status: 404, description: 'Projet introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Modifier un projet',
    description: 'Client : uniquement ses propres projets. Admin : tous.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @GetUser() user: User,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un projet' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.projectsService.remove(id, user);
  }

  // ── Jalons ───────────────────────────────────────────────

  @Patch(':id/milestones/:milestoneId')
  @Roles(Role.CLIENT, Role.ADMIN, Role.ANALYSTE)
  @ApiOperation({
    summary: 'Mettre à jour le statut d\'un jalon',
    description:
      'Transitions : en_attente → en_cours → termine. Les timestamps startedAt / completedAt sont gérés automatiquement.',
  })
  @ApiResponse({ status: 200, description: 'Jalon mis à jour' })
  @ApiResponse({ status: 404, description: 'Projet ou jalon introuvable' })
  updateMilestone(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneStatusDto,
    @GetUser() user: User,
  ) {
    return this.projectsService.updateMilestoneStatus(id, milestoneId, dto, user);
  }
}
