import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../enums/notification-type.enum';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  message: string;

  @ApiProperty()
  lu: boolean;

  @ApiProperty()
  createdAt: Date;
}
