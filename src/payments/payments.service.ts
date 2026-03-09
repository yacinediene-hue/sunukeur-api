import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRequest, OTP_THRESHOLD_XOF } from './entities/payment-request.entity';
import { PaymentAttachment } from './entities/payment-attachment.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { Currency } from './enums/currency.enum';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { AnalysteReviewDto, ClientReviewDto, ReviewAction } from './dto/review-payment.dto';
import { DisbursePaymentDto } from './dto/disburse-payment.dto';
import { OtpService } from './otp.service';
import { PaydunyaService } from './paydunya.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentRequest)
    private readonly paymentRepo: Repository<PaymentRequest>,

    @InjectRepository(PaymentAttachment)
    private readonly attachmentRepo: Repository<PaymentAttachment>,

    private readonly otpService: OtpService,
    private readonly paydunyaService: PaydunyaService,
  ) {}

  // ── Création ─────────────────────────────────────────────

  async create(dto: CreatePaymentRequestDto, prestataire: User): Promise<PaymentRequest> {
    const payment = this.paymentRepo.create({
      montant: dto.montant,
      devise: dto.devise,
      description: dto.description,
      statut: PaymentStatus.SOUMIS,
      prestataireId: prestataire.id,
    });

    const saved = await this.paymentRepo.save(payment);

    if (dto.attachments?.length) {
      const attachments = dto.attachments.map((a) =>
        this.attachmentRepo.create({ ...a, paymentRequestId: saved.id }),
      );
      await this.attachmentRepo.save(attachments);
    }

    return this.findOneOrFail(saved.id);
  }

  // ── Lecture ──────────────────────────────────────────────

  async findAll(user: User): Promise<PaymentRequest[]> {
    const qb = this.paymentRepo
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.attachments', 'attachments')
      .orderBy('pr.createdAt', 'DESC');

    switch (user.role) {
      case Role.PRESTATAIRE:
        qb.where('pr.prestataireId = :uid', { uid: user.id });
        break;
      case Role.ANALYSTE:
        // Analyste voit tout ce qui est soumis ou déjà en cours d'analyse
        qb.where('pr.statut IN (:...statuts)', {
          statuts: [PaymentStatus.SOUMIS, PaymentStatus.EN_ANALYSE],
        }).orWhere('pr.analysteId = :uid', { uid: user.id });
        break;
      case Role.CLIENT:
        // Client voit les demandes en attente de sa validation + les siennes
        qb.where('pr.statut = :statut', { statut: PaymentStatus.EN_ANALYSE })
          .orWhere('pr.clientId = :uid', { uid: user.id });
        break;
      default:
        // ADMIN : tout
        break;
    }

    return qb.getMany();
  }

  async findOne(id: string, user: User): Promise<PaymentRequest> {
    const pr = await this.findOneOrFail(id);
    this.assertAccess(pr, user);
    return pr;
  }

  // ── Workflow analyste ────────────────────────────────────

  /**
   * L'analyste valide ou rejette une demande au statut SOUMIS.
   * Transition : SOUMIS → EN_ANALYSE | REJETE
   */
  async analysteReview(
    id: string,
    dto: AnalysteReviewDto,
    analyste: User,
  ): Promise<PaymentRequest> {
    const pr = await this.findOneOrFail(id);

    if (pr.statut !== PaymentStatus.SOUMIS) {
      throw new BadRequestException(
        `Impossible : la demande est au statut "${pr.statut}". Seules les demandes "soumis" peuvent être traitées par l'analyste.`,
      );
    }

    pr.analysteId = analyste.id;
    pr.commentaireAnalyste = dto.commentaire ?? null;
    pr.analysedAt = new Date();

    if (dto.action === ReviewAction.VALIDER) {
      pr.statut = PaymentStatus.EN_ANALYSE;
      this.logger.log(`[Payments] #${id} → EN_ANALYSE par analyste ${analyste.id}`);
    } else {
      pr.statut = PaymentStatus.REJETE;
      pr.motifRejet = dto.motifRejet!;
      this.logger.log(`[Payments] #${id} → REJETE par analyste ${analyste.id}`);
    }

    return this.paymentRepo.save(pr);
  }

  // ── Envoi OTP ────────────────────────────────────────────

  /**
   * Envoie un OTP au client pour les demandes > 500 000 XOF.
   * Pré-condition : statut = EN_ANALYSE et montant > seuil.
   */
  async requestOtp(id: string, client: User): Promise<{ message: string }> {
    const pr = await this.findOneOrFail(id);

    if (pr.statut !== PaymentStatus.EN_ANALYSE) {
      throw new BadRequestException(
        'OTP disponible uniquement pour les demandes au statut "en_analyse".',
      );
    }

    if (!pr.requiresOtp) {
      throw new BadRequestException(
        `OTP non requis pour ce montant (seuil : ${OTP_THRESHOLD_XOF.toLocaleString()} XOF).`,
      );
    }

    if (!client.phone) {
      throw new BadRequestException(
        'Numéro de téléphone manquant dans votre profil.',
      );
    }

    this.otpService.sendOtp(id, client.phone);

    return {
      message: `Un code OTP a été envoyé au ${client.phone}. Valide 10 minutes.`,
    };
  }

  // ── Workflow client ──────────────────────────────────────

  /**
   * Le client valide ou rejette une demande au statut EN_ANALYSE.
   * Transition : EN_ANALYSE → VALIDE | REJETE
   * Si > 500 000 XOF, l'OTP est obligatoire avant validation.
   */
  async clientReview(
    id: string,
    dto: ClientReviewDto,
    client: User,
  ): Promise<PaymentRequest> {
    const pr = await this.findOneOrFail(id);

    if (pr.statut !== PaymentStatus.EN_ANALYSE) {
      throw new BadRequestException(
        `Impossible : la demande est au statut "${pr.statut}". Seules les demandes "en_analyse" peuvent être validées par le client.`,
      );
    }

    if (dto.action === ReviewAction.VALIDER) {
      // Vérification OTP si requis
      if (pr.requiresOtp) {
        if (!dto.otpCode) {
          throw new BadRequestException(
            `Un OTP est requis pour les paiements supérieurs à ${OTP_THRESHOLD_XOF.toLocaleString()} XOF. Appelez d'abord POST /payments/${id}/request-otp.`,
          );
        }
        const valid = this.otpService.verifyOtp(id, dto.otpCode);
        if (!valid) {
          throw new ForbiddenException(
            'Code OTP invalide ou expiré.',
          );
        }
        pr.otpVerified = true;
      }

      pr.statut = PaymentStatus.VALIDE;
      pr.validatedAt = new Date();
      this.logger.log(`[Payments] #${id} → VALIDE par client ${client.id}`);
    } else {
      pr.statut = PaymentStatus.REJETE;
      pr.motifRejet = dto.motifRejet!;
      this.logger.log(`[Payments] #${id} → REJETE par client ${client.id}`);
    }

    pr.clientId = client.id;
    pr.commentaireClient = dto.commentaire ?? null;

    return this.paymentRepo.save(pr);
  }

  // ── Déboursement PayDunya ────────────────────────────────

  /**
   * Déclenche le paiement effectif via PayDunya.
   * Pré-condition : statut = VALIDE.
   * Transition : VALIDE → PAYE
   */
  async disburse(
    id: string,
    dto: DisbursePaymentDto,
    actor: User,
  ): Promise<PaymentRequest> {
    const pr = await this.findOneOrFail(id);

    if (pr.statut !== PaymentStatus.VALIDE) {
      throw new BadRequestException(
        `Déboursement impossible : la demande est au statut "${pr.statut}". Statut requis : "valide".`,
      );
    }

    this.logger.log(
      `[Payments] #${id} — Déboursement ${dto.methodePaiement} → ${dto.compteDestinataire}`,
    );

    const result = await this.paydunyaService.disburse(
      dto.methodePaiement,
      dto.compteDestinataire,
      Number(pr.montant),
      pr.devise,
      pr.description,
    );

    pr.methodePaiement = dto.methodePaiement;
    pr.compteDestinataire = dto.compteDestinataire;
    pr.transactionId = result.transactionId;
    pr.statut = PaymentStatus.PAYE;
    pr.paidAt = new Date();

    this.logger.log(
      `[Payments] #${id} → PAYE — TXN: ${result.transactionId}`,
    );

    return this.paymentRepo.save(pr);
  }

  // ── Helpers privés ───────────────────────────────────────

  private async findOneOrFail(id: string): Promise<PaymentRequest> {
    const pr = await this.paymentRepo.findOne({
      where: { id },
      relations: ['attachments'],
    });
    if (!pr) throw new NotFoundException(`Demande de paiement #${id} introuvable.`);
    return pr;
  }

  private assertAccess(pr: PaymentRequest, user: User): void {
    if (user.role === Role.ADMIN || user.role === Role.ANALYSTE) return;

    if (
      user.role === Role.PRESTATAIRE &&
      pr.prestataireId !== user.id
    ) {
      throw new ForbiddenException('Accès refusé à cette demande de paiement.');
    }

    if (
      user.role === Role.CLIENT &&
      pr.clientId !== user.id &&
      pr.statut !== PaymentStatus.EN_ANALYSE
    ) {
      throw new ForbiddenException('Accès refusé à cette demande de paiement.');
    }
  }
}
