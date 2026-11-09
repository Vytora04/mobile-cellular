import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport } from '../types/index.js';

export class TelkomselAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'telkomsel';
  private bearerToken?: string;

  constructor(phoneNumber: string, bearerToken?: string, isMock: boolean = true) {
    super(phoneNumber, 'https://tdw-api.telkomsel.com', isMock);
    this.bearerToken = bearerToken;

    if (this.bearerToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.bearerToken}`;
    }
  }

  async loginWithOtp(phone: string, otp?: string): Promise<{ success: boolean; message: string; token?: string }> {
    if (this.isMock) {
      if (!otp) {
        return { success: true, message: `[MOCK] OTP dikirim ke Telkomsel ${phone}` };
      }
      return { success: true, message: `[MOCK] Login Telkomsel berhasil`, token: 'mock-telkomsel-token-xyz' };
    }

    try {
      if (!otp) {
        // Step 1: Kirim request OTP
        await this.client.post('/v1/auth/request-otp', { msisdn: phone });
        return { success: true, message: `OTP berhasil dikirim ke nomor Telkomsel ${phone}` };
      } else {
        // Step 2: Verifikasi OTP
        const res = await this.client.post('/v1/auth/verify-otp', { msisdn: phone, otp });
        const token = res.data?.data?.access_token;
        this.bearerToken = token;
        return { success: true, message: 'Verifikasi Telkomsel berhasil', token };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Gagal login Telkomsel' };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock || !this.bearerToken) {
      return {
        operator: 'telkomsel',
        phoneNumber: this.phoneNumber,
        balance: 25000,
        activeUntil: '2026-12-15',
        packages: [
          {
            name: 'Internet MAX Utama',
            remainingGB: 18.5,
            totalGB: 25.0,
            expiresAt: '2026-12-15',
          },
          {
            name: 'Kuota Nonton (OMG!)',
            remainingGB: 5.2,
            totalGB: 10.0,
            expiresAt: '2026-12-15',
          },
        ],
      };
    }

    try {
      const res = await this.client.get('/v2/subscribers/quota-summary');
      const data = res.data?.data;

      return {
        operator: 'telkomsel',
        phoneNumber: this.phoneNumber,
        balance: data?.balance || 0,
        activeUntil: data?.active_until || '',
        packages: (data?.packages || []).map((pkg: any) => ({
          name: pkg.package_name,
          remainingGB: Number((pkg.remaining_bytes / (1024 ** 3)).toFixed(2)),
          totalGB: Number((pkg.total_bytes / (1024 ** 3)).toFixed(2)),
          expiresAt: pkg.expired_date,
        })),
      };
    } catch (error: any) {
      throw new Error(`[Telkomsel] Gagal mengecek kuota: ${error.response?.data?.message || error.message}`);
    }
  }
}
