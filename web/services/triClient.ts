import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { sha512 } from 'js-sha512';

export interface PackageQuotaItem {
  name: string;
  remainingGB: number;
  totalGB: number;
  percentage: number;
  expiresAt: string;
}

export interface MobileQuotaReport {
  operator: 'TRI';
  phoneNumber: string;
  balance: number;
  activeUntil: string;
  totalRemainingGB: number;
  totalInitialGB: number;
  packages: PackageQuotaItem[];
  fetchedAt: string;
}

export interface TriMobileSession {
  phoneNumber: string;
  authorization: string;
  tokenId: string;
  deviceId: string;
  faiid: string;
  serviceKey: string;
  updatedAt: string;
  lastReport?: MobileQuotaReport;
}

const STORAGE_SESSIONS_KEY = 'qm_tri_sessions_v1';
const STORAGE_ACTIVE_PHONE_KEY = 'qm_active_phone_v1';
const STORAGE_PENDING_OTP_KEY = 'qm_pending_otp_v1';

const DEFAULT_AUTH = '642d1cc69d90666962726e';
const DEFAULT_DEVICE_ID = '117178975203478994b3fb1a4b555cea';
const DEFAULT_FAIID = 'dS576wMV4B4rhwhOuIKd0B';
const DEFAULT_SERVICE_KEY = 'FPi7ZP3Jy8Uv3KBd4QeG';

// --- FORMATTERS ---

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('8')) {
    digits = '0' + digits;
  }
  return digits;
}

export function toMsisdn62(phone: string): string {
  const clean = formatPhoneNumber(phone);
  return clean.startsWith('0') ? '62' + clean.slice(1) : '62' + clean;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateInput: string | undefined | null): string {
  if (!dateInput) return '-';
  const raw = String(dateInput).trim();
  if (!raw || raw === '-') return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{14}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

// --- CRYPTO HELPERS (BIMA+ SHA512) ---

function getOddPositionCharacters(str: string): string {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    if (i % 2 === 0) res += str[i];
  }
  return res;
}

export function getSHA512EncryptedBody(tokenId: string, bodyString: string): string {
  const salt = getOddPositionCharacters(tokenId || '');
  return sha512(`REQBODY=${bodyString}&SALT=${salt}`);
}

export function getSHA512Encrypted(uid: string, hashParams: string): string {
  const salt = getOddPositionCharacters(uid || '');
  return sha512(`${hashParams}&SALT=${salt}`);
}

export function generateUid(): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const sss = pad(now.getMilliseconds(), 3);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}${sss}${rand}`;
}

// --- JWT & LOCALSTORAGE SESSION MANAGER ---

export function decodeJwtPayload(token?: string): any | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function checkTokenStatus(token?: string): {
  isValid: boolean;
  expiresAt?: string;
  daysLeft?: number;
} {
  const payload = decodeJwtPayload(token);
  if (!payload) return { isValid: false };
  if (payload.utype === 'GUEST' || payload.autp === 'GUEST' || payload.logintype === 'GUEST') {
    return { isValid: false };
  }
  if (payload.exp && typeof payload.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec >= payload.exp) {
      return { isValid: false };
    }
    const expDate = new Date(payload.exp * 1000);
    const daysLeft = Math.max(0, Math.ceil((payload.exp - nowSec) / 86400));
    return {
      isValid: true,
      expiresAt: expDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      daysLeft,
    };
  }
  return { isValid: true };
}

export function getAllSessions(): Record<string, TriMobileSession> {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getSession(phone: string): TriMobileSession | null {
  const clean = formatPhoneNumber(phone);
  const all = getAllSessions();
  return all[clean] || null;
}

export function saveSession(session: TriMobileSession): void {
  const clean = formatPhoneNumber(session.phoneNumber);
  const all = getAllSessions();
  all[clean] = {
    ...session,
    phoneNumber: clean,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(all));
  setActivePhone(clean);
}

export function removeSession(phone: string): void {
  const clean = formatPhoneNumber(phone);
  const all = getAllSessions();
  delete all[clean];
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(all));

  if (getActivePhone() === clean) {
    const remaining = Object.keys(all);
    localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, remaining[0] || '');
  }
}

export function getActivePhone(): string | null {
  const active = localStorage.getItem(STORAGE_ACTIVE_PHONE_KEY);
  const all = getAllSessions();
  if (active && all[active]) return active;
  const first = Object.keys(all)[0];
  if (first) {
    localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, first);
    return first;
  }
  return null;
}

export function setActivePhone(phone: string): void {
  localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, formatPhoneNumber(phone));
}

// --- HTTP CLIENT (CAPACITOR NATIVE + VITE DEV PROXY) ---

async function postBimaEndpoint(
  endpointPath: string,
  payload: Record<string, any>,
  tokenId: string = '',
  authorization: string = DEFAULT_AUTH,
  deviceId: string = DEFAULT_DEVICE_ID,
  faiid: string = DEFAULT_FAIID,
  serviceKey: string = DEFAULT_SERVICE_KEY
): Promise<{ data: any; headers: Record<string, string> }> {
  const bodyStr = JSON.stringify(payload);
  const uid = generateUid();
  const oauth = getSHA512EncryptedBody(tokenId, bodyStr);
  const hashParams = `parent$BROWSER$5.2.0$${tokenId}`;
  const hash = getSHA512Encrypted(uid, hashParams);

  const isNative = Capacitor.isNativePlatform();
  const baseUrl = isNative
    ? 'https://bimaplus-api.ioh.co.id'
    : '/bima-api';

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'authorization': authorization || DEFAULT_AUTH,
    'x-imi-app-os': 'BROWSER',
    'x-imi-appversion': '5.2.0',
    'x-imi-channel': 'PORTAL',
    'x-imi-language': 'ID',
    'x-imi-version': '5.2.0',
    'x-devicename': 'Windows PC (Windows)',
    'x-deviceid': deviceId || DEFAULT_DEVICE_ID,
    'x-faiid': faiid || DEFAULT_FAIID,
    'x-imi-servicekey': serviceKey || DEFAULT_SERVICE_KEY,
    'x-imi-tokenid': tokenId,
    'x-imi-oauth': oauth,
    'x-imi-hash': hash,
    'x-imi-uid': uid,
  };

  if (isNative) {
    headers['origin'] = 'https://bimatri.ioh.co.id';
    headers['referer'] = 'https://bimatri.ioh.co.id/';
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0';

    const res = await CapacitorHttp.post({
      url: `${baseUrl}${endpointPath}`,
      headers,
      data: payload,
    });

    const parsedData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return {
      data: parsedData,
      headers: res.headers || {},
    };
  } else {
    const res = await fetch(`${baseUrl}${endpointPath}`, {
      method: 'POST',
      headers,
      body: bodyStr,
    });

    const parsedData = await res.json();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k.toLowerCase()] = v;
    });

    return {
      data: parsedData,
      headers: resHeaders,
    };
  }
}

// --- API OPERATIONS ---

/**
 * 1. Request OTP via SMS
 */
export async function requestTriOtp(
  phone: string
): Promise<{ success: boolean; message: string; transid?: string }> {
  const clean = formatPhoneNumber(phone);
  if (!clean || clean.length < 9) {
    return { success: false, message: 'Format nomor HP tidak valid (minimal 10 digit).' };
  }

  try {
    // 1. Ambil guest token baru
    const guestRes = await postBimaEndpoint('/api/v2/token/guest', {}, '');
    const guestData = guestRes.data;

    if (guestData?.status !== '0' || !guestData?.data?.tokenid) {
      return {
        success: false,
        message: guestData?.message || 'Gagal menginisialisasi sesi tamu Bima+.',
      };
    }

    const guestTokenId = guestData.data.tokenid;

    // 2. Kirim request OTP
    const msisdn = toMsisdn62(clean);
    const otpRes = await postBimaEndpoint(
      '/api/v2/otp/send/v1',
      { msisdn, action: 'register' },
      guestTokenId
    );
    const otpData = otpRes.data;

    if (otpData?.status !== '0' && otpData?.message?.toLowerCase() !== 'success') {
      return {
        success: false,
        message: otpData?.message || 'Gagal mengirim SMS OTP ke nomor tersebut.',
      };
    }

    const transid =
      otpData?.transid || otpData?.data?.transid || otpData?.data?.transId || otpData?.transId;

    if (!transid) {
      return {
        success: false,
        message: 'Server tidak mengembalikan Transaction ID (transid).',
      };
    }

    // Simpan state pending OTP di localStorage
    localStorage.setItem(
      STORAGE_PENDING_OTP_KEY,
      JSON.stringify({
        phone: clean,
        transid,
        guestTokenId,
        createdAt: Date.now(),
      })
    );

    return {
      success: true,
      message: otpData?.message || `Kode OTP telah dikirim via SMS ke ${clean}`,
      transid,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Terjadi gangguan jaringan saat meminta OTP.',
    };
  }
}

/**
 * 2. Verify OTP & Save Session
 */
export async function verifyTriOtp(
  phone: string,
  otp: string
): Promise<{ success: boolean; message: string }> {
  const clean = formatPhoneNumber(phone);
  const cleanOtp = String(otp).trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return { success: false, message: 'Kode OTP harus terdiri dari 6 digit angka.' };
  }

  try {
    const rawPending = localStorage.getItem(STORAGE_PENDING_OTP_KEY);
    if (!rawPending) {
      return {
        success: false,
        message: 'Sesi OTP tidak ditemukan. Silakan klik "Minta OTP" terlebih dahulu.',
      };
    }

    const pending = JSON.parse(rawPending);
    if (pending.phone !== clean || !pending.transid) {
      return {
        success: false,
        message: 'Nomor HP berbeda dengan permintaan OTP sebelumnya. Minta OTP ulang.',
      };
    }

    const verifyRes = await postBimaEndpoint(
      '/api/v2/otp/validate/v1',
      {
        transid: pending.transid,
        otp: cleanOtp,
      },
      pending.guestTokenId || ''
    );

    const resData = verifyRes.data;
    if (resData?.status !== '0' && resData?.message?.toLowerCase() !== 'success') {
      return {
        success: false,
        message: `${resData?.message || 'Kode OTP tidak valid'} (Code: ${resData?.code || 'unknown'})`,
      };
    }

    const data = resData.data || {};
    const newTokenId =
      data.tokenid || data.token || data.jwt_token || verifyRes.headers['x-imi-tokenid'];
    const newAuth =
      data.secret_token || data.authorization || verifyRes.headers['authorization'] || DEFAULT_AUTH;

    if (!newTokenId) {
      return {
        success: false,
        message: 'Verifikasi berhasil namun token autentikasi tidak ditemukan.',
      };
    }

    saveSession({
      phoneNumber: clean,
      authorization: newAuth,
      tokenId: newTokenId,
      deviceId: DEFAULT_DEVICE_ID,
      faiid: DEFAULT_FAIID,
      serviceKey: DEFAULT_SERVICE_KEY,
      updatedAt: new Date().toISOString(),
    });

    localStorage.removeItem(STORAGE_PENDING_OTP_KEY);

    return {
      success: true,
      message: 'Login berhasil! Sesi telah disimpan.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal memverifikasi OTP.',
    };
  }
}

/**
 * 3. Login Cepat dengan Token Sesi (x-imi-tokenid)
 */
export async function loginWithTokenId(
  phone: string,
  tokenId: string
): Promise<{ success: boolean; message: string }> {
  const clean = formatPhoneNumber(phone);
  const cleanToken = String(tokenId).trim();

  if (!clean || clean.length < 9) {
    return { success: false, message: 'Masukkan nomor HP Tri yang valid.' };
  }

  const status = checkTokenStatus(cleanToken);
  if (!status.isValid) {
    return {
      success: false,
      message: 'Token tidak valid, berstatus GUEST, atau sudah kedaluwarsa.',
    };
  }

  saveSession({
    phoneNumber: clean,
    authorization: DEFAULT_AUTH,
    tokenId: cleanToken,
    deviceId: DEFAULT_DEVICE_ID,
    faiid: DEFAULT_FAIID,
    serviceKey: DEFAULT_SERVICE_KEY,
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: 'Token berhasil divalidasi dan disimpan!',
  };
}

/**
 * 4. Fetch Live Dashboard Quota & Balance
 */
export async function fetchTriDashboard(phone: string): Promise<MobileQuotaReport> {
  const clean = formatPhoneNumber(phone);
  const session = getSession(clean);

  if (!session || !session.tokenId) {
    throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
  }

  const tokenCheck = checkTokenStatus(session.tokenId);
  if (!tokenCheck.isValid) {
    throw new Error('Sesi token telah berakhir (Expired). Silakan login kembali.');
  }

  const res = await postBimaEndpoint(
    '/api/v2/dashboard/get/v4',
    {},
    session.tokenId,
    session.authorization,
    session.deviceId,
    session.faiid,
    session.serviceKey
  );

  const resData = res.data;
  if (resData?.status !== '0' && resData?.message?.toLowerCase() !== 'success') {
    throw new Error(resData?.message || 'Gagal mengambil data dashboard dari Bima+.');
  }

  const data = resData.data || {};
  const resolvedPhone = formatPhoneNumber(data?.msisdn || data?.packdata?.msisdn || clean);
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

  const packages: PackageQuotaItem[] = [];
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
          } else if (q.quotaUnit === 'MB' && q.initialQuota > 0) {
            totGB = Number(((q.initialQuota || 0) / 1024).toFixed(2));
          } else if (pkg.total_data && pkg.total_data > 0) {
            totGB = Number((pkg.total_data / (1024 * 1024)).toFixed(2));
          } else {
            totGB = remGB;
          }

          const quotaTitle =
            q.name && q.name !== packageName ? `${packageName} (${q.name})` : packageName;
          const pct = totGB > 0 ? Math.min(100, Math.round((remGB / totGB) * 1000) / 10) : 0;

          packages.push({
            name: quotaTitle,
            remainingGB: remGB,
            totalGB: totGB,
            percentage: pct,
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
        percentage: totalGB > 0 ? 100 : 0,
        expiresAt: exp,
      });
    }
  }

  if (packages.length === 0 && data?.summary?.data) {
    const sumData = data.summary.data;
    const remGB = Number(((sumData.remainingquota || 0) / (1024 * 1024)).toFixed(2));
    const totGB = Number(((sumData.initialquota || 0) / (1024 * 1024)).toFixed(2));
    const pct = totGB > 0 ? Math.min(100, Math.round((remGB / totGB) * 1000) / 10) : 0;
    packages.push({
      name: sumData.title || 'Kuota Data Utama',
      remainingGB: remGB,
      totalGB: totGB,
      percentage: pct,
      expiresAt: activeUntil,
    });
  }

  const totalRemainingGB = Number(
    packages.reduce((acc, p) => acc + p.remainingGB, 0).toFixed(2)
  );
  const totalInitialGB = Number(
    packages.reduce((acc, p) => acc + p.totalGB, 0).toFixed(2)
  );

  const report: MobileQuotaReport = {
    operator: 'TRI',
    phoneNumber: resolvedPhone,
    balance,
    activeUntil,
    totalRemainingGB,
    totalInitialGB,
    packages,
    fetchedAt: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  // Simpan cache report terakhir di session localStorage
  saveSession({
    ...session,
    phoneNumber: resolvedPhone,
    lastReport: report,
  });

  return report;
}
