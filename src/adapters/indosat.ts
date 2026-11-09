import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport } from '../types/index.js';

export class IndosatAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'indosat';
  private accessToken?: string;

  constructor(phoneNumber: string, accessToken?: string, isMock: boolean = true) {
    super(phoneNumber, 'https://myim3app.indosatooredoo.com', isMock);
    this.accessToken = accessToken;

    if (this.accessToken) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    }
  }

  async loginWithOtp(phone: string, otp?: string): Promise<{ success: boolean; message: string; token?: string }> {
    if (this.isMock) {
      if (!otp) {
        return { success: true, message: `[MOCK] OTP dikirim via SMS ke Indosat IM3 ${phone}` };
      }
      return { success: true, message: `[MOCK] Login Indosat berhasil`, token: 'mock-indosat-token-abc' };
    }

    try {
      if (!otp) {
        await this.client.post('/api/v1/auth/otp/send', { msisdn: phone });
        return { success: true, message: `OTP berhasil dikirim ke nomor Indosat ${phone}` };
      } else {
        const res = await this.client.post('/api/v1/auth/otp/verify', { msisdn: phone, otp });
        const token = res.data?.access_token;
        this.accessToken = token;
        return { success: true, message: 'Verifikasi Indosat berhasil', token };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Gagal login Indosat' };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock || !this.accessToken) {
      return {
        operator: 'indosat',
        phoneNumber: this.phoneNumber,
        balance: 45000,
        activeUntil: '2026-12-31',
        packages: [
          {
            name: 'Freedom Internet 50GB',
            remainingGB: 32.7,
            totalGB: 50.0,
            expiresAt: '2026-12-05',
          },
          {
            name: 'Bonus Kuota Aplikasi & Malam',
            remainingGB: 7.1,
            totalGB: 10.0,
            expiresAt: '2026-12-05',
          },
        ],
      };
    }

    try {
      const res = await this.client.get('/api/v1/account/quota');
      const data = res.data?.data;

      return {
        operator: 'indosat',
        phoneNumber: this.phoneNumber,
        balance: data?.main_balance || 0,
        activeUntil: data?.expired_date || '',
        packages: (data?.quotas || []).map((quota: any) => ({
          name: quota.name,
          remainingGB: Number((quota.remaining_mb / 1024).toFixed(2)),
          totalGB: Number((quota.total_mb / 1024).toFixed(2)),
          expiresAt: quota.expiry,
        })),
      };
    } catch (error: any) {
      throw new Error(`[Indosat] Gagal mengecek kuota: ${error.response?.data?.message || error.message}`);
    }
  }
}
