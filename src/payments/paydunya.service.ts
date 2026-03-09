import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from './enums/payment-method.enum';
import { Currency } from './enums/currency.enum';

// ── Types PayDunya ────────────────────────────────────────────────────────────

export interface PaydunyaDisbursementResult {
  transactionId: string;
  status: 'success' | 'pending' | 'failed';
  message: string;
}

interface PaydunyaMobilePayload {
  account_alias: string; // numéro de téléphone E.164
  amount: number;
  withdraw_mode: string; // code opérateur PayDunya
  description?: string;
}

interface PaydunyaBankPayload {
  account_iban: string;
  account_name: string;
  amount: number;
  currency: string;
  description?: string;
}

// Mapping méthode → code PayDunya
const PAYDUNYA_WITHDRAW_MODES: Record<string, string> = {
  [PaymentMethod.ORANGE_MONEY]: 'orange-money-senegal',
  [PaymentMethod.WAVE]: 'wave-senegal',
  [PaymentMethod.FREE_MONEY]: 'free-money-senegal',
};

const PAYDUNYA_BASE_URL = 'https://app.paydunya.com/api/v1';

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PaydunyaService {
  private readonly logger = new Logger(PaydunyaService.name);

  private readonly masterKey: string;
  private readonly privateKey: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.masterKey = config.getOrThrow<string>('PAYDUNYA_MASTER_KEY');
    this.privateKey = config.getOrThrow<string>('PAYDUNYA_PRIVATE_KEY');
    this.token = config.getOrThrow<string>('PAYDUNYA_TOKEN');
  }

  /**
   * Déclenche un déboursement via PayDunya.
   *
   * @param method             Méthode de paiement
   * @param compteDestinataire Téléphone (mobile money) ou IBAN (virement)
   * @param montant            Montant à envoyer
   * @param devise             Devise (XOF, EUR, USD)
   * @param description        Référence ou objet du virement
   */
  async disburse(
    method: PaymentMethod,
    compteDestinataire: string,
    montant: number,
    devise: Currency,
    description: string,
  ): Promise<PaydunyaDisbursementResult> {
    if (method === PaymentMethod.VIREMENT) {
      return this.disburseBankTransfer(
        compteDestinataire,
        montant,
        devise,
        description,
      );
    }
    return this.disburseMobileMoney(
      method,
      compteDestinataire,
      montant,
      description,
    );
  }

  // ── Mobile Money ────────────────────────────────────────

  private async disburseMobileMoney(
    method: PaymentMethod,
    phone: string,
    montant: number,
    description: string,
  ): Promise<PaydunyaDisbursementResult> {
    const withdrawMode = PAYDUNYA_WITHDRAW_MODES[method];
    const payload: PaydunyaMobilePayload = {
      account_alias: phone,
      amount: Math.round(montant),
      withdraw_mode: withdrawMode,
      description,
    };

    this.logger.log(
      `[PayDunya] Déboursement mobile (${withdrawMode}) → ${phone} : ${montant} XOF`,
    );

    const raw = await this.post<{
      response_code: string;
      transaction_id?: string;
      description?: string;
    }>('/direct-pay/credit-account', payload);

    if (raw.response_code !== '00') {
      this.logger.error(
        `[PayDunya] Échec déboursement: ${raw.description ?? raw.response_code}`,
      );
      throw new InternalServerErrorException(
        `PayDunya : ${raw.description ?? 'Erreur inconnue'}`,
      );
    }

    return {
      transactionId: raw.transaction_id ?? `TXN-${Date.now()}`,
      status: 'success',
      message: raw.description ?? 'Déboursement effectué',
    };
  }

  // ── Virement bancaire ────────────────────────────────────

  private async disburseBankTransfer(
    iban: string,
    montant: number,
    devise: Currency,
    description: string,
  ): Promise<PaydunyaDisbursementResult> {
    const payload: PaydunyaBankPayload = {
      account_iban: iban,
      account_name: 'Bénéficiaire Sunukeur',
      amount: montant,
      currency: devise,
      description,
    };

    this.logger.log(
      `[PayDunya] Virement bancaire → IBAN ${iban} : ${montant} ${devise}`,
    );

    const raw = await this.post<{
      response_code: string;
      transaction_id?: string;
      description?: string;
    }>('/direct-pay/bank-transfer', payload);

    if (raw.response_code !== '00') {
      throw new InternalServerErrorException(
        `PayDunya : ${raw.description ?? 'Erreur inconnue'}`,
      );
    }

    return {
      transactionId: raw.transaction_id ?? `TXN-${Date.now()}`,
      status: 'success',
      message: raw.description ?? 'Virement initié',
    };
  }

  // ── Vérification statut ──────────────────────────────────

  async checkTransactionStatus(
    transactionId: string,
  ): Promise<{ status: string; description: string }> {
    const raw = await this.post<{
      transaction_status: string;
      description?: string;
    }>('/direct-pay/check-status', { transaction_id: transactionId });

    return {
      status: raw.transaction_status,
      description: raw.description ?? '',
    };
  }

  // ── Utilitaire HTTP ──────────────────────────────────────

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${PAYDUNYA_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': this.masterKey,
        'PAYDUNYA-PRIVATE-KEY': this.privateKey,
        'PAYDUNYA-TOKEN': this.token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`[PayDunya] HTTP ${response.status} — ${text}`);
      throw new InternalServerErrorException(
        `PayDunya HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
