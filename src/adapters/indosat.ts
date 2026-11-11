import fs from 'node:fs';
import path from 'node:path';
import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport, PackageQuota } from '../types/index.js';
import { formatPhoneNumber, formatDate } from '../utils/format.js';
import {
  generateUid,
  getSHA512EncryptedBody,
  getSHA512Encrypted,
} from '../utils/crypto.js';

export interface IndosatAuthConfig {
  authorization?: string;
  tokenId?: string;
  deviceId?: string;
  faiid?: string;
  serviceKey?: string;
}

const SESSION_FILE_PATH = path.resolve(process.cwd(), 'session_indosat.json');

export class IndosatAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'indosat';
  private authConfig: IndosatAuthConfig = {};

  constructor(phoneNumber: string, auth?: string | IndosatAuthConfig, isMock: boolean = true) {
    super(phoneNumber, 'https://myim3api1.ioh.co.id', isMock);

    // Cek session_indosat.json
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const raw = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf-8'));
        if (raw.tokenId) {
          this.authConfig = { ...raw };
          if (auth === undefined) {
            this.isMock = false;
          }
        }
      }
    } catch {}

    if (typeof auth === 'string') {
      this.authConfig.tokenId = auth;
    } else if (auth) {
      this.authConfig = { ...this.authConfig, ...auth };
    }

    if (!this.authConfig.authorization) {
      this.authConfig.authorization = '642d1cc69d90666962726e';
    }
    if (!this.authConfig.deviceId) {
      this.authConfig.deviceId = '117178975203478994b3fb1a4b555cea';
    }
    if (!this.authConfig.faiid) {
      this.authConfig.faiid = 'dS576wMV4B4rhwhOuIKd0B';
    }
    if (!this.authConfig.serviceKey) {
      this.authConfig.serviceKey = 'i4WxFMMLvWqnrvuAyg58';
    }

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use((config) => {
      let bodyStr = '';
      if (typeof config.data === 'string') {
        bodyStr = config.data;
      } else if (config.data !== undefined && config.data !== null) {
        bodyStr = JSON.stringify(config.data);
      }

      const uid = generateUid();
      const tokenId = this.authConfig.tokenId || '';
      const oauth = getSHA512EncryptedBody(tokenId, bodyStr);
      const hashParams = `parent$BROWSER$4.1$${tokenId}`;
      const hash = getSHA512Encrypted(uid, hashParams);

      config.headers['accept'] = 'application/json, text/plain, */*';
      config.headers['content-type'] = 'application/json';
      config.headers['origin'] = 'https://myim3.ioh.co.id';
      config.headers['referer'] = 'https://myim3.ioh.co.id/';
      config.headers['user-agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
      config.headers['authorization'] = this.authConfig.authorization || '642d1cc69d90666962726e';
      config.headers['x-imi-app-os'] = 'BROWSER';
      config.headers['x-imi-appversion'] = '4.1';
      config.headers['x-imi-channel'] = 'PORTAL';
      config.headers['x-imi-language'] = 'ID';
      config.headers['x-imi-version'] = '4.1';
      config.headers['x-devicename'] = 'Windows PC (Windows)';
      config.headers['x-deviceid'] = this.authConfig.deviceId || '117178975203478994b3fb1a4b555cea';
      config.headers['x-faiid'] = this.authConfig.faiid || 'dS576wMV4B4rhwhOuIKd0B';
      config.headers['x-imi-servicekey'] = this.authConfig.serviceKey || 'i4WxFMMLvWqnrvuAyg58';
      config.headers['x-imi-tokenid'] = tokenId;
      config.headers['x-imi-oauth'] = oauth;
      config.headers['x-imi-hash'] = hash;
      config.headers['x-imi-uid'] = uid;

      return config;
    });
  }

  async loginWithOtp(phone: string, otp?: string): Promise<{ success: boolean; message: string; token?: string }> {
    if (this.isMock) {
      if (!otp) {
        return { success: true, message: `[MOCK] OTP dikirim via SMS ke Indosat IM3 ${phone}` };
      }
      return { success: true, message: `[MOCK] Login Indosat berhasil`, token: 'mock-indosat-token-abc' };
    }

    try {
      const clean = formatPhoneNumber(phone);
      const msisdn = clean.startsWith('0') ? '62' + clean.slice(1) : '62' + clean;

      if (!otp) {
        const guestRes = await this.client.post('/api/v2/token/guest', {});
        const guestData = guestRes.data;
        const guestTokenId = guestData?.data?.tokenid;
        if (!guestTokenId) {
          return { success: false, message: 'Gagal menginisialisasi sesi tamu Indosat' };
        }

        const otpRes = await this.client.post('/api/v2/otp/send/v1', { msisdn, action: 'register' });
        const otpData = otpRes.data;
        const transid = otpData?.transid || otpData?.data?.transid || otpData?.data?.transId;

        return {
          success: true,
          message: `OTP resmi myIM3 berhasil dikirim ke nomor ${phone} (transid: ${transid})`,
          token: transid,
        };
      } else {
        const res = await this.client.post('/api/v2/otp/validate/v1', {
          transid: this.authConfig.tokenId || '',
          otp,
        });
        const resData = res.data;
        const tokenId = resData?.data?.tokenid || resData?.data?.token;
        if (tokenId) {
          this.authConfig.tokenId = tokenId;
          fs.writeFileSync(
            SESSION_FILE_PATH,
            JSON.stringify({ ...this.authConfig, phoneNumber: phone, updatedAt: new Date().toISOString() }, null, 2),
            'utf-8'
          );
          return { success: true, message: 'Verifikasi Indosat berhasil', token: tokenId };
        }
        return { success: false, message: resData?.message || 'Kode OTP tidak valid' };
      }
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || error.message || 'Gagal login Indosat' };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    if (this.isMock || !this.authConfig.tokenId) {
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
        ],
      };
    }

    try {
      const res = await this.client.post('/api/v2/dashboard/get/v4', {});
      const data = res.data?.data;
      if (!data) {
        throw new Error(res.data?.message || 'Gagal memuat dashboard');
      }

      const rawBalance = data?.prepaidinfo?.balance ?? data?.packdata?.lastbalance ?? 0;
      const balance =
        typeof rawBalance === 'string'
          ? parseFloat(rawBalance.replace(/[^0-9.-]+/g, '')) || 0
          : Number(rawBalance);

      const activeUntil = formatDate(
        data?.prepaidinfo?.cardactiveuntil ||
          data?.prepaidinfo?.expires ||
          data?.packdata?.expireddate ||
          ''
      );

      const packages: PackageQuota[] = [];
      const packageslist = data?.packdata?.packageslist || [];

      for (const pkg of packageslist) {
        const packageName = pkg.PackageName || pkg.ServiceDescription || 'Paket Internet';
        const exp = formatDate(pkg.EndDate || pkg.expMsg || '');

        if (Array.isArray(pkg.Quotas) && pkg.Quotas.length > 0) {
          for (const q of pkg.Quotas) {
            const benefit = (q.benefitType || '').toUpperCase();
            if (!benefit || benefit === 'DATA' || benefit === 'INTERNET') {
              let remGB = 0;
              let totGB = 0;

              if (typeof q.rawRemainingQuota === 'number' && q.rawRemainingQuota > 0) {
                remGB = Number((q.rawRemainingQuota / 1024 ** 3).toFixed(2));
              } else if (q.quotaUnit === 'MB') {
                remGB = Number(((q.remainingQuota || 0) / 1024).toFixed(2));
              } else if (q.quotaUnit === 'KB') {
                remGB = Number(((q.remainingQuota || 0) / (1024 * 1024)).toFixed(2));
              }

              if (typeof q.rawInitialQuota === 'number' && q.rawInitialQuota > 0) {
                totGB = Number((q.rawInitialQuota / 1024 ** 3).toFixed(2));
              } else if (q.quotaUnit === 'MB') {
                totGB = Number(((q.totalQuota || 0) / 1024).toFixed(2));
              } else if (q.quotaUnit === 'KB') {
                totGB = Number(((q.totalQuota || 0) / (1024 * 1024)).toFixed(2));
              }

              if (totGB === 0 && remGB > 0) {
                totGB = remGB;
              }

              packages.push({
                name: q.name || q.quotaName || packageName,
                remainingGB: remGB,
                totalGB: totGB,
                expiresAt: exp || activeUntil,
              });
            }
          }
        } else {
          packages.push({
            name: packageName,
            remainingGB: 0,
            totalGB: 0,
            expiresAt: exp || activeUntil,
          });
        }
      }

      return {
        operator: 'indosat',
        phoneNumber: this.phoneNumber,
        balance,
        activeUntil,
        packages,
      };
    } catch (error: any) {
      throw new Error(`[Indosat] Gagal mengecek kuota: ${error.response?.data?.message || error.message}`);
    }
  }
}
