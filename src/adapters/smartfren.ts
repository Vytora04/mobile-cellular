import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport, PackageQuota } from '../types/index.js';
import { formatPhoneNumber } from '../utils/format.js';

export class SmartfrenAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'smartfren';
  private accessToken?: string;

  constructor(phoneNumber: string, token?: string, isMock: boolean = true) {
    super(phoneNumber, 'https://mysmartfren.smartfren.com/api', isMock);
    this.accessToken = token;
  }

  async loginWithOtp(
    phone: string,
    otp?: string
  ): Promise<{ success: boolean; message: string; token?: string }> {
    const cleanPhone = formatPhoneNumber(phone);

    if (this.isMock) {
      if (!otp) {
        return {
          success: true,
          message: `[MOCK] SMS OTP Smartfren simulasi telah dikirim ke ${cleanPhone}. Gunakan OTP: 123456`,
        };
      }
      return {
        success: true,
        message: `[MOCK] Verifikasi OTP Smartfren sukses untuk nomor ${cleanPhone}!`,
        token: `mock-smartfren-token-${Date.now()}`,
      };
    }

    return {
      success: false,
      message: 'Live API Smartfren belum diimplementasikan. Gunakan APP_MODE=mock.',
    };
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock) {
      const packages: PackageQuota[] = [
        {
          name: 'Smartfren Kuota Nonstop 45GB',
          remainingGB: 28.4,
          totalGB: 45.0,
          expiresAt: '2026-12-28',
        },
        {
          name: 'Bonus Kuota Malam 15GB',
          remainingGB: 12.1,
          totalGB: 15.0,
          expiresAt: '2026-12-28',
        },
      ];

      return {
        operator: this.operator,
        phoneNumber: this.phoneNumber,
        balance: 30000,
        activeUntil: '2026-12-31',
        packages,
      };
    }

    throw new Error('Live API Smartfren belum aktif. Silakan gunakan mode MOCK.');
  }
}

