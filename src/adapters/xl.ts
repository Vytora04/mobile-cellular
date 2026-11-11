import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport, PackageQuota } from '../types/index.js';
import { formatPhoneNumber, formatDate } from '../utils/format.js';

const SESSION_FILE_PATH = path.resolve(process.cwd(), 'session_xl.json');
const BASE_URL = 'https://api.myxl.xlaxiata.co.id/api/v8';
const API_KEY = 'zAkj4SVtW3tjLuDjf56oyg==';

interface XlSessionData {
  phoneNumber: string;
  accessToken: string;
  subscriberId?: string;
  deviceId?: string;
  updatedAt: string;
}

export class XlAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'xl';
  private accessToken: string = '';
  private deviceId: string = '';

  constructor(phoneNumber: string, token?: string, isMock: boolean = false) {
    super(phoneNumber, BASE_URL, isMock);
    this.deviceId = crypto.randomUUID();

    if (token) {
      this.accessToken = token;
    } else {
      this.loadSession();
    }
  }

  private loadSession(): void {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const data: Record<string, XlSessionData> = JSON.parse(raw);
        const session = data[this.phoneNumber];
        if (session && session.accessToken) {
          this.accessToken = session.accessToken;
          if (session.deviceId) this.deviceId = session.deviceId;
        }
      }
    } catch {
      // Ignored
    }
  }

  private saveSession(token: string, subscriberId?: string): void {
    try {
      let data: Record<string, XlSessionData> = {};
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        data = JSON.parse(raw);
      }
      data[this.phoneNumber] = {
        phoneNumber: this.phoneNumber,
        accessToken: token,
        subscriberId,
        deviceId: this.deviceId,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      this.accessToken = token;
    } catch {
      // Ignored
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'ax-request-id': crypto.randomUUID(),
      'ax-request-at': new Date().toISOString(),
      'ax-device-id': this.deviceId,
      'ax-request-device': 'android',
      'ax-request-device-model': 'Samsung SM-G998B',
      'ax-substype': 'PREPAID',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
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
          message: `[MOCK] SMS OTP simulasi XL telah dikirim ke ${cleanPhone}. Gunakan OTP: 123456`,
        };
      }
      const mockToken = `mock-xl-token-${Date.now()}`;
      this.saveSession(mockToken);
      return {
        success: true,
        message: `[MOCK] Verifikasi OTP XL berhasil untuk nomor ${cleanPhone}!`,
        token: mockToken,
      };
    }

    try {
      // Step 1: Request OTP
      if (!otp) {
        const res = await this.client.post(
          '/auth/regist/request-otp',
          {
            msisdn: cleanPhone,
            requestFor: 'LOGIN',
          },
          { headers: this.getHeaders() }
        );

        if (res.data?.status === 'SUCCESS' || res.data?.status === '0' || res.status === 200) {
          return {
            success: true,
            message: res.data?.message || `Kode OTP XL berhasil dikirim ke nomor ${cleanPhone}`,
          };
        }

        return {
          success: false,
          message: res.data?.message || 'Gagal meminta OTP dari server XL.',
        };
      }

      // Step 2: Validate OTP
      const verifyRes = await this.client.post(
        '/auth/regist/validate-otp',
        {
          msisdn: cleanPhone,
          otp: otp.trim(),
          requestFor: 'LOGIN',
        },
        { headers: this.getHeaders() }
      );

      const resData = verifyRes.data || {};
      const token =
        resData.token ||
        resData.accessToken ||
        resData.data?.token ||
        resData.data?.accessToken;

      if (token) {
        this.saveSession(token, resData.subscriberId || resData.data?.subscriberId);
        return {
          success: true,
          message: 'Verifikasi OTP berhasil, sesi XL disimpan!',
          token,
        };
      }

      return {
        success: false,
        message: resData.message || 'Kode OTP tidak valid atau kedaluwarsa.',
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message;
      return {
        success: false,
        message: `Gangguan komunikasi API XL: ${errMsg}`,
      };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock) {
      return {
        operator: this.operator,
        phoneNumber: this.phoneNumber,
        balance: 35000,
        activeUntil: '2026-12-25',
        packages: [
          {
            name: 'Xtra Combo Flex VIP',
            remainingGB: 24.5,
            totalGB: 30.0,
            expiresAt: '2026-12-25',
          },
          {
            name: 'Bonus Kuota YouTube & TikTok',
            remainingGB: 6.2,
            totalGB: 10.0,
            expiresAt: '2026-12-25',
          },
        ],
      };
    }

    if (!this.accessToken) {
      throw new Error(
        `Token XL untuk ${this.phoneNumber} tidak ditemukan. Silakan login OTP terlebih dahulu.`
      );
    }

    try {
      // 1. Fetch Pulsa / Balance
      const balRes = await this.client.post(
        '/packages/balance-and-credit',
        {},
        { headers: this.getHeaders() }
      );
      const balData = balRes.data?.data || balRes.data || {};
      const balance = Number(balData.balance?.remaining || balData.balance || 0);
      const activeUntil = balData.balance?.expiredAt
        ? formatDate(new Date(balData.balance.expiredAt).toISOString())
        : balData.graceEndDate
        ? formatDate(new Date(balData.graceEndDate).toISOString())
        : '-';

      // 2. Fetch Quota Details
      const detailsRes = await this.client.post(
        '/packages/quota-details',
        {},
        { headers: this.getHeaders() }
      );
      const detailsData = detailsRes.data?.data || detailsRes.data || [];
      const packages: PackageQuota[] = [];

      if (Array.isArray(detailsData)) {
        for (const item of detailsData) {
          const remBytes = Number(item.remaining || 0);
          const totBytes = Number(item.total || remBytes);
          packages.push({
            name: item.quotaLabel || item.name || 'Paket Internet XL',
            remainingGB: Number((remBytes / (1024 ** 3)).toFixed(2)),
            totalGB: Number((totBytes / (1024 ** 3)).toFixed(2)),
            expiresAt: item.expiredAt ? formatDate(new Date(item.expiredAt).toISOString()) : activeUntil,
          });
        }
      }

      // 3. Fallback to Quota Summary if packages list empty
      if (packages.length === 0) {
        const sumRes = await this.client.post(
          '/packages/quota-summary',
          {},
          { headers: this.getHeaders() }
        );
        const sumData = sumRes.data?.data?.quota || sumRes.data?.quota || {};
        const remBytes = Number(sumData.remaining || 0);
        const totBytes = Number(sumData.total || remBytes);
        packages.push({
          name: sumRes.data?.planType || 'Kuota Utama XL',
          remainingGB: Number((remBytes / (1024 ** 3)).toFixed(2)),
          totalGB: Number((totBytes / (1024 ** 3)).toFixed(2)),
          expiresAt: activeUntil,
        });
      }

      return {
        operator: this.operator,
        phoneNumber: this.phoneNumber,
        balance,
        activeUntil,
        packages,
      };
    } catch (err: any) {
      throw new Error(`Gagal mengambil data kuota XL: ${err.response?.data?.message || err.message}`);
    }
  }
}

