import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import twilio = require('twilio');
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-type.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private emailTransporter: nodemailer.Transporter;
  private twilioClient: ReturnType<typeof twilio> | null = null;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly config: ConfigService,
  ) {
    // Setup email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });

    // Setup Twilio client if credentials exist
    const twilioSid = this.config.get('TWILIO_ACCOUNT_SID');
    const twilioToken = this.config.get('TWILIO_AUTH_TOKEN');
    if (twilioSid && twilioToken) {
      this.twilioClient = twilio(twilioSid, twilioToken);
    }
  }

  // ── Send & persist ────────────────────────────────────────

  async send(
    user: User,
    type: NotificationType,
    message: string,
  ): Promise<Notification> {
    // Persist notification in DB
    const notification = this.notificationRepo.create({
      userId: user.id,
      type,
      message,
    });
    await this.notificationRepo.save(notification);

    // Send email (fire-and-forget)
    if (user.email) {
      this.sendEmail(user.email, type, message).catch((err) =>
        this.logger.error(`Email send failed for ${user.email}: ${err.message}`),
      );
    }

    // Send SMS (fire-and-forget)
    if (user.phone) {
      this.sendSms(user.phone, message).catch((err) =>
        this.logger.error(`SMS send failed for ${user.phone}: ${err.message}`),
      );
    }

    return notification;
  }

  // ── Event helpers ─────────────────────────────────────────

  async notifyProjectCreated(user: User, projectName: string) {
    return this.send(
      user,
      NotificationType.PROJECT_CREATED,
      `Votre projet "${projectName}" a été créé avec succès.`,
    );
  }

  async notifyMilestoneFunded(user: User, milestoneName: string, amount: number) {
    return this.send(
      user,
      NotificationType.MILESTONE_FUNDED,
      `Le jalon "${milestoneName}" a été financé à hauteur de ${amount} FCFA.`,
    );
  }

  async notifyPaymentRequestCreated(user: User, amount: number) {
    return this.send(
      user,
      NotificationType.PAYMENT_REQUEST_CREATED,
      `Une demande de paiement de ${amount} FCFA a été soumise et est en cours d'examen.`,
    );
  }

  async notifyPaymentValidated(user: User, amount: number) {
    return this.send(
      user,
      NotificationType.PAYMENT_VALIDATED,
      `Votre demande de paiement de ${amount} FCFA a été validée.`,
    );
  }

  async notifyPaymentCompleted(user: User, amount: number) {
    return this.send(
      user,
      NotificationType.PAYMENT_COMPLETED,
      `Le paiement de ${amount} FCFA a été effectué avec succès.`,
    );
  }

  // ── Queries ───────────────────────────────────────────────

  findAllForUser(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }
    notification.lu = true;
    return this.notificationRepo.save(notification);
  }

  // ── Private helpers ───────────────────────────────────────

  private async sendEmail(to: string, type: NotificationType, message: string) {
    const subject = this.getEmailSubject(type);
    await this.emailTransporter.sendMail({
      from: `"Sunukeur" <${this.config.get('SMTP_FROM', 'noreply@sunukeur.sn')}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Sunukeur</h2>
          <p>${message}</p>
          <hr />
          <small style="color: #6b7280;">Plateforme de gestion de projets de construction</small>
        </div>
      `,
    });
    this.logger.log(`Email sent to ${to} — type: ${type}`);
  }

  private async sendSms(to: string, message: string) {
    if (!this.twilioClient) {
      this.logger.warn('Twilio non configuré — SMS ignoré');
      return;
    }
    const from = this.config.get('TWILIO_PHONE_NUMBER');
    await this.twilioClient.messages.create({ body: message, from, to });
    this.logger.log(`SMS sent to ${to}`);
  }

  private getEmailSubject(type: NotificationType): string {
    const subjects: Record<NotificationType, string> = {
      [NotificationType.PROJECT_CREATED]: 'Projet créé — Sunukeur',
      [NotificationType.MILESTONE_FUNDED]: 'Jalon financé — Sunukeur',
      [NotificationType.PAYMENT_REQUEST_CREATED]: 'Demande de paiement soumise — Sunukeur',
      [NotificationType.PAYMENT_VALIDATED]: 'Paiement validé — Sunukeur',
      [NotificationType.PAYMENT_COMPLETED]: 'Paiement effectué — Sunukeur',
    };
    return subjects[type] ?? 'Notification — Sunukeur';
  }
}
