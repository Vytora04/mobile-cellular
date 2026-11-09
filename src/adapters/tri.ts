import { BaseOperatorAdapter } from './base.js';
import { OperatorName, QuotaReport, PackageQuota } from '../types/index.js';
import { formatPhoneNumber, formatDate } from '../utils/format.js';
import {
  generateUid,
  getSHA512EncryptedBody,
  getSHA512Encrypted,
} from '../utils/crypto.js';
import {
  getTriSession,
  saveTriSession,
  savePendingOtpSession,
  getPendingOtpSession,
  clearPendingOtpSession,
  isUserSessionToken,
} from '../utils/session.js';

export interface TriAuthConfig {
  authorization?: string; // TRI_BEARER_TOKEN / Header authorization ('642d1cc69d90666962726e')
  tokenId?: string;       // x-imi-tokenid (JWT)
  oauth?: string;         // x-imi-oauth
  hash?: string;          // x-imi-hash
  uid?: string;           // x-imi-uid
  deviceId?: string;      // x-deviceid
  faiid?: string;         // x-faiid
  serviceKey?: string;    // x-imi-servicekey
}

export class TriAdapter extends BaseOperatorAdapter {
  readonly operator: OperatorName = 'tri';
  private authConfig: TriAuthConfig = {};
  private currentTransId?: string;
  private currentGuestTokenId?: string;

  constructor(phoneNumber: string, auth?: string | TriAuthConfig, isMock: boolean = true) {
    // Base URL resmi Bima+ IOH
    super(phoneNumber, 'https://bimaplus-api.ioh.co.id', isMock);

    // 1. Cek sesi tersimpan di session_tri.json
    const savedSession = getTriSession(this.phoneNumber);
    if (savedSession) {
      this.authConfig = { ...savedSession };
    } else if (typeof auth === 'string') {
      this.authConfig = { authorization: auth };
    } else if (auth) {
      this.authConfig = { ...auth };
    }

    // Default static credentials dari Bima+ Portal
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
      this.authConfig.serviceKey = 'FPi7ZP3Jy8Uv3KBd4QeG';
    }

    this.setupInterceptors();
  }

  /**
   * Konfigurasi Axios Request Interceptor
   * Setiap request secara dinamis membuat UID baru dan menandatangani request body
   * dengan algoritma SHA512 Bima+ IOH:
   * 1. x-imi-oauth = SHA512("REQBODY=" + JSON.stringify(body) + "&SALT=" + oddChars(tokenId))
   * 2. X-IMI-HASH  = SHA512("parent$BROWSER$5.2.0$" + tokenId + "&SALT=" + oddChars(uid))
   */
  private setupInterceptors(): void {
    this.client.interceptors.request.use((config) => {
      // Standarisasi string body untuk perhitungan hash
      let bodyStr = '';
      if (typeof config.data === 'string') {
        bodyStr = config.data;
      } else if (config.data !== undefined && config.data !== null) {
        bodyStr = JSON.stringify(config.data);
      }

      const uid = generateUid();
      const tokenId = this.authConfig.tokenId || '';
      const oauth = getSHA512EncryptedBody(tokenId, bodyStr);
      const hashParams = `parent$BROWSER$5.2.0$${tokenId}`;
      const hash = getSHA512Encrypted(uid, hashParams);

      config.headers['accept'] = 'application/json, text/plain, */*';
      config.headers['content-type'] = 'application/json';
      config.headers['origin'] = 'https://bimatri.ioh.co.id';
      config.headers['referer'] = 'https://bimatri.ioh.co.id/';
      config.headers['user-agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0';
      config.headers['authorization'] = this.authConfig.authorization || '642d1cc69d90666962726e';
      config.headers['x-imi-app-os'] = 'BROWSER';
      config.headers['x-imi-appversion'] = '5.2.0';
      config.headers['x-imi-channel'] = 'PORTAL';
      config.headers['x-imi-language'] = 'ID';
      config.headers['x-imi-version'] = '5.2.0';
      config.headers['x-devicename'] = 'Windows PC (Windows)';
      config.headers['x-deviceid'] = this.authConfig.deviceId || '117178975203478994b3fb1a4b555cea';
      config.headers['x-faiid'] = this.authConfig.faiid || 'dS576wMV4B4rhwhOuIKd0B';
      config.headers['x-imi-servicekey'] = this.authConfig.serviceKey || 'FPi7ZP3Jy8Uv3KBd4QeG';

      // Header dinamis
      config.headers['x-imi-tokenid'] = tokenId;
      config.headers['x-imi-oauth'] = oauth;
      config.headers['x-imi-hash'] = hash;
      config.headers['x-imi-uid'] = uid;

      return config;
    });
  }

  public getAuthConfig(): TriAuthConfig {
    return { ...this.authConfig };
  }

  public updateAuthConfig(newConfig: Partial<TriAuthConfig>): void {
    this.authConfig = { ...this.authConfig, ...newConfig };
  }

  /**
   * Mengambil token tamu (guest webtoken) dari endpoint resmi Bima+
   */
  public async requestGuestToken(): Promise<string> {
    const savedTokenId = this.authConfig.tokenId;
    // Set tokenId sementara kosong agar hash guest token terhitung akurat
    this.authConfig.tokenId = '';

    try {
      const res = await this.client.post('/api/v2/token/guest', {});
      const resData = res.data;
      if (resData?.status === '0' && resData?.data?.tokenid) {
        return resData.data.tokenid;
      }
      throw new Error(resData?.message || 'Gagal memperoleh guest token dari server Bima+');
    } catch (err: any) {
      // Kembalikan tokenId semula jika gagal
      this.authConfig.tokenId = savedTokenId;
      throw new Error(`[Tri] Request guest token gagal: ${err.response?.data?.message || err.message}`);
    }
  }

  /**
   * Alur Autentikasi Bima+ Tri:
   * 1. Jika `otp` kosong:
   *    - Meminta guest token baru dari server Bima+.
   *    - Mengirim kode OTP via SMS ke nomor Tri (/api/v2/otp/send/v1).
   *    - Menyimpan `transid` & `guestTokenId` untuk proses validasi.
   * 2. Jika `otp` diisi:
   *    - Memverifikasi OTP (/api/v2/otp/validate/v1) menggunakan `guestTokenId` dan signature yang cocok.
   *    - Menyimpan token user aktif ke `session_tri.json`.
   */
  async loginWithOtp(
    phone: string,
    otp?: string
  ): Promise<{ success: boolean; message: string; token?: string; transid?: string }> {
    if (this.isMock) {
      if (!otp) {
        return {
          success: true,
          message: `[MOCK] OTP dikirim via SMS ke Tri ${phone}`,
          transid: 'mock-tri-transid-123',
        };
      }
      return {
        success: true,
        message: `[MOCK] Verifikasi OTP Tri berhasil`,
        token: 'mock-tri-verified-token',
      };
    }

    const clean = formatPhoneNumber(phone);
    // Format konsisten awalan 62 untuk API Bima+
    const msisdn = clean.startsWith('0') ? '62' + clean.slice(1) : clean.startsWith('62') ? clean : '62' + clean;

    try {
      if (!otp) {
        // --- STEP 1: Request OTP ---
        // 1. Ambil guest token baru
        const guestTokenId = await this.requestGuestToken();
        this.currentGuestTokenId = guestTokenId;
        this.authConfig.tokenId = guestTokenId;

        // 2. Kirim OTP
        const res = await this.client.post('/api/v2/otp/send/v1', {
          msisdn,
          action: 'register',
        });

        const resData = res.data;
        if (resData?.status !== '0' && resData?.message && resData?.message.toLowerCase() !== 'success') {
          return {
            success: false,
            message: resData?.message || 'Gagal mengirim OTP Tri',
          };
        }

        const transid =
          resData?.transid ||
          resData?.data?.transid ||
          resData?.data?.transId ||
          resData?.transId;

        if (!transid) {
          return {
            success: false,
            message: 'Gagal mendapatkan Transaction ID (transid) dari respon server Tri.',
          };
        }

        this.currentTransId = transid;
        // Simpan ke pending session agar tahan restart CLI
        savePendingOtpSession(clean, transid, guestTokenId);

        return {
          success: true,
          message: resData?.message || `Kode OTP berhasil dikirim ke nomor Tri ${phone}`,
          transid,
        };
      } else {
        // --- STEP 2: Verify OTP ---
        const pending = getPendingOtpSession(clean);
        const transid = this.currentTransId || pending.transId;
        const guestTokenId = this.currentGuestTokenId || pending.guestTokenId;

        if (!transid) {
          return {
            success: false,
            message: 'Transaction ID (transid) tidak ditemukan. Mohon panggil request OTP terlebih dahulu.',
          };
        }

        if (guestTokenId) {
          this.authConfig.tokenId = guestTokenId;
        }

        // Sesuai cURL asli Bima+: body hanya membutuhkan transid dan otp
        const verifyPayload = {
          transid,
          otp: String(otp).trim(),
        };

        const res = await this.client.post('/api/v2/otp/validate/v1', verifyPayload);
        const resData = res.data;

        if (resData?.status !== '0' && resData?.message && resData?.message.toLowerCase() !== 'success') {
          return {
            success: false,
            message: `${resData?.message || 'Kode OTP tidak valid'} (Code: ${resData?.code || 'unknown'})`,
          };
        }

        // Ekstrak token user resmi dari response
        const data = resData.data || {};
        const newAuthTokenId =
          data.tokenid ||
          data.token ||
          data.jwt_token ||
          (res.headers['x-imi-tokenid'] as string);

        const newAuthHeader =
          data.secret_token ||
          data.authorization ||
          (res.headers['authorization'] as string) ||
          this.authConfig.authorization;

        if (!newAuthTokenId) {
          return {
            success: false,
            message: 'Verifikasi berhasil tetapi tidak menerima token autentikasi dari server Tri.',
          };
        }

        // Update memori adapter
        this.updateAuthConfig({
          authorization: newAuthHeader,
          tokenId: newAuthTokenId,
        });

        // Simpan sesi ke session_tri.json untuk digunakan pemanggilan berikutnya
        saveTriSession(clean, this.authConfig);
        clearPendingOtpSession(clean);
        this.currentTransId = undefined;
        this.currentGuestTokenId = undefined;

        return {
          success: true,
          message: 'Verifikasi Tri berhasil dan sesi telah disimpan!',
          token: newAuthTokenId,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Gagal login Tri',
      };
    }
  }

  async checkQuota(): Promise<QuotaReport> {
    const hasUserSession = isUserSessionToken(this.authConfig.tokenId);

    if (this.isMock) {
      return {
        operator: 'tri',
        phoneNumber: this.phoneNumber,
        balance: 12500,
        activeUntil: '2027-01-20',
        packages: [
          {
            name: 'AON (AlwaysOn) Reguler',
            remainingGB: 14.0,
            totalGB: 16.0,
            expiresAt: '2027-01-20',
          },
          {
            name: 'Kuota Happy 24 Jam',
            remainingGB: 8.4,
            totalGB: 12.0,
            expiresAt: '2026-11-30',
          },
        ],
      };
    }

    if (!hasUserSession) {
      throw new Error(
        'Belum login atau token sesi Tri telah kedaluwarsa. Silakan jalankan `npm run login` untuk login via OTP.'
      );
    }

    try {
      const res = await this.client.post('/api/v2/dashboard/get/v4', {});
      const resData = res.data;

      if (resData.status !== '0' && resData.message && resData.message.toLowerCase() !== 'success') {
        if (
          resData.code === '10002' ||
          (resData.message && resData.message.includes('verification process'))
        ) {
          throw new Error('Sesi/Token Bima+ telah kedaluwarsa (Code 10002). Silakan login ulang via `npm run login`');
        }
        throw new Error(resData.message || 'Respons tidak berhasil dari API Tri');
      }

      const data = resData.data;
      const phone = formatPhoneNumber(data?.msisdn || data?.packdata?.msisdn || this.phoneNumber);
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
                remGB = Number((q.rawRemainingQuota / (1024 ** 3)).toFixed(2));
              } else if (q.quotaUnit === 'MB') {
                remGB = Number(((q.remainingQuota || 0) / 1024).toFixed(2));
              } else if (q.quotaUnit === 'KB') {
                remGB = Number(((q.remainingQuota || 0) / (1024 * 1024)).toFixed(2));
              }

              if (typeof q.rawInitialQuota === 'number' && q.rawInitialQuota > 0) {
                totGB = Number((q.rawInitialQuota / (1024 ** 3)).toFixed(2));
              } else if (q.quotaUnit === 'MB' && q.initialQuota > 0) {
                totGB = Number(((q.initialQuota || 0) / 1024).toFixed(2));
              } else if (pkg.total_data && pkg.total_data > 0) {
                totGB = Number((pkg.total_data / (1024 * 1024)).toFixed(2));
              } else {
                totGB = remGB;
              }

              const quotaTitle =
                q.name && q.name !== packageName ? `${packageName} (${q.name})` : packageName;

              packages.push({
                name: quotaTitle,
                remainingGB: remGB,
                totalGB: totGB,
                expiresAt: exp || formatDate(q.expiryDate),
              });
            }
          }
        } else {
          const totalKB = pkg.total_data || 0;
          const totalGB = Number((totalKB / (1024 * 1024)).toFixed(2));
          packages.push({
            name: packageName,
            remainingGB: totalGB,
            totalGB: totalGB,
            expiresAt: exp,
          });
        }
      }

      // Fallback ke summary data jika paket detail tidak memiliki kuota list
      if (packages.length === 0 && data?.summary?.data) {
        const sumData = data.summary.data;
        const remKB = sumData.remainingquota || 0;
        const initKB = sumData.initialquota || 0;
        packages.push({
          name: sumData.title || 'Kuota Data Utama',
          remainingGB: Number((remKB / (1024 * 1024)).toFixed(2)),
          totalGB: Number((initKB / (1024 * 1024)).toFixed(2)),
          expiresAt: activeUntil,
        });
      }

      return {
        operator: 'tri',
        phoneNumber: phone,
        balance,
        activeUntil,
        packages,
      };
    } catch (error: any) {
      throw new Error(`[Tri] Gagal mengecek kuota: ${error.response?.data?.message || error.message}`);
    }
  }
}
