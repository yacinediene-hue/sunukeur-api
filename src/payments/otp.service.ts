import { Injectable, Logger } from '@nestjs/common';

interface OtpEntry {
  code: string;
  expiresAt: Date;
  phone: string;
}

/** Durée de validité d'un OTP en millisecondes (10 minutes). */
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  /**
   * Génère et « envoie » un OTP pour une demande de paiement.
   * En production, remplacer le logger.log par un vrai appel SMS
   * (Orange SMS API, Twilio, etc.).
   *
   * @param paymentRequestId  Clé de déduplication
   * @param phone             Numéro destinataire au format E.164
   * @returns                 L'OTP en clair (utile pour les tests ; en prod ne pas retourner)
   */
  sendOtp(paymentRequestId: string, phone: string): string {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    this.store.set(paymentRequestId, { code, expiresAt, phone });

    // TODO: remplacer par un appel réel au fournisseur SMS
    this.logger.log(
      `[OTP] Envoi vers ${phone} — code: ${code} (expire: ${expiresAt.toISOString()})`,
    );

    return code;
  }

  /**
   * Vérifie un OTP et le consomme (usage unique).
   *
   * @returns `true` si valide et non expiré, `false` sinon.
   */
  verifyOtp(paymentRequestId: string, code: string): boolean {
    const entry = this.store.get(paymentRequestId);

    if (!entry) {
      this.logger.warn(`[OTP] Aucun OTP trouvé pour ${paymentRequestId}`);
      return false;
    }

    if (new Date() > entry.expiresAt) {
      this.store.delete(paymentRequestId);
      this.logger.warn(`[OTP] OTP expiré pour ${paymentRequestId}`);
      return false;
    }

    if (entry.code !== code) {
      this.logger.warn(`[OTP] Code incorrect pour ${paymentRequestId}`);
      return false;
    }

    this.store.delete(paymentRequestId); // usage unique
    return true;
  }

  private generateCode(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  }
}
