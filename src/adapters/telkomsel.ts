import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport } from '../types/index.js';

export class TelkomselAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'telkomsel';
  private sessionLogin?: string;
  private deviceId: string;
  private lastSignatureOtp?: string;
  private serviceType: string = 'PREPAID';

  constructor(phoneNumber: string, sessionLogin?: string, isMock: boolean = false) {
    super(phoneNumber, 'https://www.telkomsel.com/api', isMock);
    this.sessionLogin = sessionLogin;
    this.deviceId = 'ae4e1d6e-d60e-4ace-8620-81e38584869e';

    if (this.sessionLogin) {
      this.client.defaults.headers.common['Cookie'] = `sessionLogin=${this.sessionLogin}`;
      this.client.defaults.headers.common['device-id'] = this.deviceId;
      this.client.defaults.headers.common['Origin'] = 'https://www.telkomsel.com';
      this.client.defaults.headers.common['Referer'] = 'https://www.telkomsel.com/user';
      this.client.defaults.headers.common['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
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
      const clean = phone.replace(/\D/g, '');
      const formatted = clean.startsWith('62') ? '0' + clean.slice(2) : clean.startsWith('8') ? '0' + clean : clean;
      this.serviceType = formatted.startsWith('0811') ? 'HALO' : 'PREPAID';

      if (!otp) {
        // Step 1: Kirim request OTP
        const res = await this.client.post(
          '/auth/v1/tsel/otp/request',
          {
            serviceType: this.serviceType,
            msisdn: formatted,
          },
          {
            headers: {
              'device-id': this.deviceId,
              'Origin': 'https://www.telkomsel.com',
              'Referer': 'https://www.telkomsel.com/login',
            },
          }
        );

        if (res.data?.data?.signatureOtp) {
          this.lastSignatureOtp = res.data.data.signatureOtp;
          return {
            success: true,
            message: `OTP berhasil dikirim ke nomor Telkomsel (${this.serviceType}) ${formatted}`,
          };
        }
        return { success: false, message: res.data?.message || 'Gagal mengirim OTP Telkomsel' };
      } else {
        // Step 2: Verifikasi OTP
        if (!this.lastSignatureOtp) {
          throw new Error('Signature OTP tidak ditemukan. Silakan kirim request OTP terlebih dahulu.');
        }

        const res = await this.client.post(
          '/auth/v1/tsel/otp/verify',
          {
            signatureOtp: this.lastSignatureOtp,
            otp: String(otp).trim(),
          },
          {
            headers: {
              'device-id': this.deviceId,
              'Origin': 'https://www.telkomsel.com',
              'Referer': 'https://www.telkomsel.com/login/verify?otpSent=true',
            },
          }
        );

        const sessionToken = res.data?.data?.sessionLogin;
        if (!sessionToken) {
          throw new Error(res.data?.message || 'Verifikasi OTP Telkomsel gagal.');
        }

        this.sessionLogin = sessionToken;
        this.client.defaults.headers.common['Cookie'] = `sessionLogin=${this.sessionLogin}`;
        return { success: true, message: 'Verifikasi Telkomsel berhasil', token: sessionToken };
      }
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || error.message || 'Gagal login Telkomsel' };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock || !this.sessionLogin) {
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
        ],
      };
    }

    try {
      // 1. Ambil Profil & Saldo/Tagihan
      const profRes = await this.client.get('/customer/v1/profile');
      const prof = profRes.data?.data || {};
      const serviceType = prof.serviceType || this.serviceType || 'PREPAID';
      const balance = prof.balance || 0;
      const activeUntil = prof.bill?.dueDate || prof.billCycle?.endDate || '-';

      // 2. Ambil Rincian Kuota
      const bonusRes = await this.client.get(`/customer/v1/active-bonuses?serviceType=${encodeURIComponent(serviceType)}`);
      const bonuses = bonusRes.data?.data?.activeBonuses || {};

      const packages: any[] = [];
      if (bonuses.internet) {
        packages.push({
          name: bonuses.internet.label || 'Kuota Internet',
          remainingGB: parseFloat(bonuses.internet.remaining) || 0,
          totalGB: parseFloat(bonuses.internet.total) || 0,
          expiresAt: activeUntil,
        });
      }
      if (bonuses.application && bonuses.application.total !== '0') {
        packages.push({
          name: bonuses.application.label || 'Kuota Aplikasi',
          remainingGB: parseFloat(bonuses.application.remaining) || 0,
          totalGB: parseFloat(bonuses.application.total) || 0,
          expiresAt: activeUntil,
        });
      }

      return {
        operator: 'telkomsel',
        phoneNumber: this.phoneNumber,
        balance,
        activeUntil,
        packages,
      };
    } catch (error: any) {
      throw new Error(`[Telkomsel] Gagal mengecek kuota: ${error.response?.data?.message || error.message}`);
    }
  }
}
