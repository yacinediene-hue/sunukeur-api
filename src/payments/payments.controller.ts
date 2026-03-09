import {
  Controller,
  Get,
  Post,
  Patch,
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
import { PaymentsService } from './payments.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { AnalysteReviewDto, ClientReviewDto } from './dto/review-payment.dto';
import { DisbursePaymentDto } from './dto/disburse-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── Création ─────────────────────────────────────────────

  @Post()
  @Roles(Role.PRESTATAIRE)
  @ApiOperation({
    summary: 'Soumettre une demande de paiement (prestataire)',
    description:
      'Le prestataire soumet une demande avec montant, devise, description et pièces justificatives. Statut initial : **soumis**.',
  })
  @ApiResponse({ status: 201, description: 'Demande créée au statut soumis' })
  create(
    @Body() dto: CreatePaymentRequestDto,
    @GetUser() user: User,
  ) {
    return this.paymentsService.create(dto, user);
  }

  // ── Lecture ──────────────────────────────────────────────

  @Get()
  @Roles(Role.PRESTATAIRE, Role.ANALYSTE, Role.CLIENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Lister les demandes de paiement',
    description:
      '• Prestataire : ses demandes.\n• Analyste : demandes "soumis" + "en_analyse".\n• Client : demandes "en_analyse" + celles qu\'il a traitées.\n• Admin : tout.',
  })
  findAll(@GetUser() user: User) {
    return this.paymentsService.findAll(user);
  }

  @Get(':id')
  @Roles(Role.PRESTATAIRE, Role.ANALYSTE, Role.CLIENT, Role.ADMIN)
  @ApiOperation({ summary: 'Détail d\'une demande de paiement' })
  @ApiResponse({ status: 404, description: 'Demande introuvable' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.paymentsService.findOne(id, user);
  }

  // ── Workflow analyste ────────────────────────────────────

  @Patch(':id/analyste-review')
  @Roles(Role.ANALYSTE, Role.ADMIN)
  @ApiOperation({
    summary: 'Revue analyste — valider ou rejeter (statut soumis → en_analyse | rejeté)',
    description:
      'L\'analyste peut valider (→ **en_analyse**) ou rejeter (→ **rejeté**) une demande **soumise**.',
  })
  @ApiResponse({ status: 200, description: 'Demande mise à jour' })
  @ApiResponse({ status: 400, description: 'Mauvais statut ou payload invalide' })
  analysteReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnalysteReviewDto,
    @GetUser() user: User,
  ) {
    return this.paymentsService.analysteReview(id, dto, user);
  }

  // ── OTP ──────────────────────────────────────────────────

  @Post(':id/request-otp')
  @Roles(Role.CLIENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander un OTP (client — montants > 500 000 XOF)',
    description:
      'Envoie un code OTP à 6 chiffres par SMS sur le téléphone du client. Valide **10 minutes**. Obligatoire avant `client-review` sur les demandes > 500 000 XOF.',
  })
  @ApiResponse({ status: 200, description: 'OTP envoyé' })
  @ApiResponse({ status: 400, description: 'OTP non requis ou numéro manquant' })
  requestOtp(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.paymentsService.requestOtp(id, user);
  }

  // ── Workflow client ──────────────────────────────────────

  @Patch(':id/client-review')
  @Roles(Role.CLIENT, Role.ADMIN)
  @ApiOperation({
    summary: 'Revue client — valider ou rejeter (statut en_analyse → validé | rejeté)',
    description:
      'Le client peut valider (→ **validé**) ou rejeter (→ **rejeté**) une demande **en_analyse**.\nSi le montant > 500 000 XOF, le champ `otpCode` est **obligatoire**.',
  })
  @ApiResponse({ status: 200, description: 'Demande mise à jour' })
  @ApiResponse({ status: 400, description: 'Mauvais statut, OTP manquant ou payload invalide' })
  @ApiResponse({ status: 403, description: 'OTP invalide ou expiré' })
  clientReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClientReviewDto,
    @GetUser() user: User,
  ) {
    return this.paymentsService.clientReview(id, dto, user);
  }

  // ── Déboursement ─────────────────────────────────────────

  @Post(':id/disburse')
  @Roles(Role.ADMIN, Role.ANALYSTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déclencher le paiement via PayDunya (statut validé → payé)',
    description:
      'Envoie les fonds au prestataire via Orange Money, Wave, Free Money ou virement bancaire.\nMéthode et compte destinataire sont requis.\n> Accessible aux rôles **admin** et **analyste**.',
  })
  @ApiResponse({ status: 200, description: 'Paiement effectué — transactionId renvoyé' })
  @ApiResponse({ status: 400, description: 'Demande pas au statut "validé"' })
  @ApiResponse({ status: 500, description: 'Erreur PayDunya' })
  disburse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisbursePaymentDto,
    @GetUser() user: User,
  ) {
    return this.paymentsService.disburse(id, dto, user);
  }
}
