import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { Role } from '../../common/enums/role.enum';

// À l'inscription publique, seuls client et prestataire sont autorisés
export class RegisterDto extends CreateUserDto {
  @ApiPropertyOptional({
    enum: [Role.CLIENT, Role.PRESTATAIRE],
    default: Role.CLIENT,
    description: 'Rôle à l\'inscription (client ou prestataire uniquement)',
  })
  @IsOptional()
  @IsEnum([Role.CLIENT, Role.PRESTATAIRE], {
    message: 'Rôle invalide. Choisissez client ou prestataire.',
  })
  role?: Role;
}
