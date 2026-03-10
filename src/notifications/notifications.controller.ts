import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister mes notifications' })
  @ApiResponse({
    status: 200,
    description: 'Liste des notifications de l\'utilisateur connecté',
    type: [NotificationResponseDto],
  })
  findAll(@GetUser() user: User) {
    return this.notificationsService.findAllForUser(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiResponse({
    status: 200,
    description: 'Notification marquée comme lue',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Notification introuvable' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
