import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { ClientDashboardDto } from './dto/client-dashboard.dto';
import { AdminDashboardDto } from './dto/admin-dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('client')
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary: 'Dashboard client',
    description:
      'Retourne les projets du client connecté, les montants financés, la progression des jalons et les statistiques globales.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard client', type: ClientDashboardDto })
  @ApiResponse({ status: 403, description: 'Accès réservé au rôle CLIENT' })
  getClientDashboard(@GetUser() user: User): Promise<ClientDashboardDto> {
    return this.dashboardService.getClientDashboard(user.id);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Dashboard administrateur',
    description:
      'Vue d\'ensemble complète : tous les projets, toutes les transactions, alertes paiements en attente et statistiques globales.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard admin', type: AdminDashboardDto })
  @ApiResponse({ status: 403, description: 'Accès réservé au rôle ADMIN' })
  getAdminDashboard(): Promise<AdminDashboardDto> {
    return this.dashboardService.getAdminDashboard();
  }
}
