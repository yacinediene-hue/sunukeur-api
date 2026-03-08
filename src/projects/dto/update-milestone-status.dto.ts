import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MilestoneStatus } from '../../common/enums/milestone-status.enum';

export class UpdateMilestoneStatusDto {
  @ApiProperty({ enum: MilestoneStatus, description: 'Nouveau statut du jalon' })
  @IsEnum(MilestoneStatus, {
    message: `Statut invalide. Valeurs acceptées : ${Object.values(MilestoneStatus).join(', ')}`,
  })
  status: MilestoneStatus;

  @ApiPropertyOptional({ example: 'Coulage du béton effectué le 05/03' })
  @IsOptional()
  @IsString()
  notes?: string;
}
