import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { sha512 } from 'js-sha512';

export type OperatorType = 'telkomsel' | 'tri' | 'indosat' | 'xl' | 'smartfren';

export interface OperatorMetadata {
  id: OperatorType;
  name: string;
  shortName: string;
  portalName: string;
  mode: 'LIVE API' | 'MOCK MODE' | 'UNAVAILABLE';
  isLiveReady: boolean;
  isAvailable?: boolean;
  placeholder: string;
  prefixes: string[];
  accentGradient: string;
  cardGradient: string;
  badgeClass: string;
  dotClass: string;
  borderFocusClass: string;
  textAccentClass: string;
}

export const OPERATORS: Record<OperatorType, OperatorMetadata> = {
  tri: {
    id: 'tri',
    name: 'Tri (3 Indonesia)',
    shortName: 'Tri (3)',
    portalName: 'Bima+ IOH',
    mode: 'LIVE API',
    isLiveReady: true,
    isAvailable: true,
    placeholder: '0895xxxxxxxxx',
    prefixes: ['0895', '0896', '0897', '0898', '0899'],
    accentGradient: 'from-rose-500 to-purple-600',
    cardGradient: 'from-rose-600 via-purple-700 to-indigo-900',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    dotClass: 'bg-rose-500',
    borderFocusClass: 'focus:border-rose-500',
    textAccentClass: 'text-rose-400',
  },
  telkomsel: {
    id: 'telkomsel',
    name: 'Telkomsel',
    shortName: 'Telkomsel',
    portalName: 'MyTelkomsel',
    mode: 'LIVE API',
    isLiveReady: true,
    isAvailable: true,
    placeholder: '0812xxxxxxxxx',
    prefixes: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'],
    accentGradient: 'from-red-600 to-orange-500',
    cardGradient: 'from-red-600 via-rose-700 to-slate-900',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    dotClass: 'bg-red-500',
    borderFocusClass: 'focus:border-red-500',
    textAccentClass: 'text-red-400',
  },
  indosat: {
    id: 'indosat',
    name: 'Indosat Ooredoo',
    shortName: 'Indosat',
    portalName: 'myIM3',
    mode: 'LIVE API',
    isLiveReady: true,
    isAvailable: true,
    placeholder: '0857xxxxxxxxx',
    prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'],
    accentGradient: 'from-amber-500 to-yellow-500',
    cardGradient: 'from-amber-500 via-orange-600 to-stone-900',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    dotClass: 'bg-amber-400',
    borderFocusClass: 'focus:border-amber-500',
    textAccentClass: 'text-amber-400',
  },
  xl: {
    id: 'xl',
    name: 'XL Axiata',
    shortName: 'XL',
    portalName: 'myXL',
    mode: 'UNAVAILABLE',
    isLiveReady: false,
    isAvailable: false,
    placeholder: '0818xxxxxxxxx',
    prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'],
    accentGradient: 'from-slate-700 to-slate-800',
    cardGradient: 'from-slate-800 via-slate-900 to-slate-950',
    badgeClass: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
    dotClass: 'bg-slate-500',
    borderFocusClass: 'focus:border-slate-600',
    textAccentClass: 'text-slate-400',
  },
  smartfren: {
    id: 'smartfren',
    name: 'Smartfren',
    shortName: 'Smartfren',
    portalName: 'MySmartfren',
    mode: 'UNAVAILABLE',
    isLiveReady: false,
    isAvailable: false,
    placeholder: '0882xxxxxxxxx',
    prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'],
    accentGradient: 'from-slate-700 to-slate-800',
    cardGradient: 'from-slate-800 via-slate-900 to-slate-950',
    badgeClass: 'bg-slate-800/60 border-slate-700/60 text-slate-400',
    dotClass: 'bg-slate-500',
    borderFocusClass: 'focus:border-slate-600',
    textAccentClass: 'text-slate-400',
  },
};

export interface PackageQuotaItem {
  name: string;
  remainingGB: number;
  totalGB: number;
  percentage: number;
  expiresAt: string;
}

export interface MobileQuotaReport {
  operator: OperatorType;
  phoneNumber: string;
  balance: number;
  activeUntil: string;
  totalRemainingGB: number;
  totalInitialGB: number;
  packages: PackageQuotaItem[];
  fetchedAt: string;
  isMock: boolean;
}

export interface MobileAccountSession {
  operator: OperatorType;
  phoneNumber: string;
  authorization: string;
  tokenId: string;
  deviceId: string;
  faiid: string;
  serviceKey: string;
  isMock: boolean;
  updatedAt: string;
  lastReport?: MobileQuotaReport;
}

const STORAGE_SESSIONS_KEY = 'qm_multi_sessions_v2';
const STORAGE_SESSIONS_ORDER_KEY = 'qm_sessions_order_v2';
const STORAGE_DELETED_KEY = 'qm_deleted_sessions_v1';
const STORAGE_LEGACY_TRI_KEY = 'qm_tri_sessions_v1';
const STORAGE_ACTIVE_PHONE_KEY = 'qm_active_phone_v2';
const STORAGE_PENDING_OTP_KEY = 'qm_pending_otp_v2';

const DEFAULT_AUTH = '642d1cc69d90666962726e';
const DEFAULT_DEVICE_ID = '117178975203478994b3fb1a4b555cea';
const DEFAULT_FAIID = 'dS576wMV4B4rhwhOuIKd0B';
const DEFAULT_SERVICE_KEY = 'FPi7ZP3Jy8Uv3KBd4QeG';
const DEFAULT_SERVICE_KEY_INDOSAT = 'i4WxFMMLvWqnrvuAyg58';

// --- FORMATTERS & AUTO-DETECT ---

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

/**
 * Deteksi otomatis operator seluler berdasarkan 4 digit prefix awal (08xx)
 */
export function detectOperatorByPrefix(phoneInput: string): OperatorType | null {
  const clean = formatPhoneNumber(phoneInput);
  if (clean.length < 4) return null;
  const prefix = clean.slice(0, 4);

  for (const op of Object.values(OPERATORS)) {
    if (op.prefixes.includes(prefix)) {
      return op.id;
    }
  }
  return null;
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

export function checkTokenStatus(
  token?: string,
  isMock: boolean = false
): {
  isValid: boolean;
  expiresAt?: string;
  daysLeft?: number;
} {
  if (isMock) {
    return { isValid: true, daysLeft: 30 };
  }
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { isValid: false };
  }
  const payload = decodeJwtPayload(token);
  // Jika bukan JWT (misal sessionLogin Telkomsel yang berupa encrypted token), token dianggap valid
  if (!payload) {
    return { isValid: token.trim().length > 10, daysLeft: 1 };
  }
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
  return { isValid: true, daysLeft: 1 };
}

export function getAllSessions(): Record<string, MobileAccountSession> {
  try {
    // Migrasi otomatis dari v1 jika ada
    const rawV2 = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (rawV2) {
      return JSON.parse(rawV2);
    }
    const rawV1 = localStorage.getItem(STORAGE_LEGACY_TRI_KEY);
    if (rawV1) {
      const legacy = JSON.parse(rawV1);
      const migrated: Record<string, MobileAccountSession> = {};
      for (const [phone, sess] of Object.entries<any>(legacy)) {
        migrated[phone] = {
          ...sess,
          operator: 'tri',
          isMock: false,
        };
      }
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

export function getSession(phone: string): MobileAccountSession | null {
  const clean = formatPhoneNumber(phone);
  const all = getAllSessions();
  return all[clean] || null;
}

export function getSessionOrder(): string[] {
  const all = getAllSessions();
  const allPhones = Object.keys(all);
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_ORDER_KEY);
    if (raw) {
      const saved: string[] = JSON.parse(raw);
      const valid = saved.filter((p) => allPhones.includes(p));
      for (const p of allPhones) {
        if (!valid.includes(p)) {
          valid.push(p);
        }
      }
      return valid;
    }
  } catch {}
  return allPhones;
}

export function saveSessionOrder(order: string[]): void {
  localStorage.setItem(STORAGE_SESSIONS_ORDER_KEY, JSON.stringify(order));
}

export function moveSessionOrder(
  phone: string,
  direction: 'first' | 'left' | 'right' | number
): string[] {
  const clean = formatPhoneNumber(phone);
  const current = getSessionOrder();
  const idx = current.indexOf(clean);
  if (idx === -1) return current;

  current.splice(idx, 1);
  if (direction === 'first') {
    current.unshift(clean);
  } else if (direction === 'left') {
    const newIdx = Math.max(0, idx - 1);
    current.splice(newIdx, 0, clean);
  } else if (direction === 'right') {
    const newIdx = Math.min(current.length, idx + 1);
    current.splice(newIdx, 0, clean);
  } else if (typeof direction === 'number') {
    const safeIdx = Math.max(0, Math.min(current.length, direction));
    current.splice(safeIdx, 0, clean);
  }
  saveSessionOrder(current);
  return current;
}

export function getDeletedSessions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeletedSession(phone: string): void {
  const clean = formatPhoneNumber(phone);
  const deleted = getDeletedSessions();
  if (!deleted.includes(clean)) {
    deleted.push(clean);
    localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(deleted));
  }
}

export function clearDeletedSession(phone: string): void {
  const clean = formatPhoneNumber(phone);
  const deleted = getDeletedSessions().filter((p) => p !== clean);
  localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(deleted));
}

export function saveSession(session: MobileAccountSession): void {
  const clean = formatPhoneNumber(session.phoneNumber);
  clearDeletedSession(clean);
  const all = getAllSessions();
  all[clean] = {
    ...session,
    phoneNumber: clean,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(all));

  const order = getSessionOrder();
  if (!order.includes(clean)) {
    order.push(clean);
    saveSessionOrder(order);
  }

  setActivePhone(clean);
}

export function removeSession(phone: string): void {
  const clean = formatPhoneNumber(phone);
  const all = getAllSessions();
  delete all[clean];
  localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(all));

  const order = getSessionOrder().filter((p) => p !== clean);
  saveSessionOrder(order);

  saveDeletedSession(clean);

  if (getActivePhone() === clean) {
    localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, order[0] || '');
  }

  // Hapus dari disk jika dev server aktif
  if (!Capacitor.isNativePlatform()) {
    fetch(`/api/local-sessions?phone=${clean}`, { method: 'DELETE' }).catch(() => {});
  }
}

export function getActivePhone(): string | null {
  const active = localStorage.getItem(STORAGE_ACTIVE_PHONE_KEY);
  const all = getAllSessions();
  if (active && all[active]) return active;
  const ordered = getSessionOrder();
  const first = ordered[0];
  if (first) {
    localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, first);
    return first;
  }
  return null;
}

export function setActivePhone(phone: string): void {
  localStorage.setItem(STORAGE_ACTIVE_PHONE_KEY, formatPhoneNumber(phone));
}

export async function syncSavedSessionsFromDisk(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return false;
  try {
    const res = await fetch('/api/local-sessions');
    if (!res.ok) return false;
    const localSessions = await res.json();
    if (!localSessions || typeof localSessions !== 'object') return false;

    const all = getAllSessions();
    const deleted = getDeletedSessions();
    let hasNew = false;
    for (const [phone, sess] of Object.entries<MobileAccountSession>(localSessions)) {
      const clean = formatPhoneNumber(phone);
      if (deleted.includes(clean)) continue;
      if (!all[clean] && sess.tokenId) {
        all[clean] = {
          ...sess,
          phoneNumber: clean,
          updatedAt: sess.updatedAt || new Date().toISOString(),
        };
        hasNew = true;
      }
    }

    if (hasNew) {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(all));
      const order = getSessionOrder();
      for (const clean of Object.keys(all)) {
        if (!order.includes(clean)) {
          order.push(clean);
        }
      }
      saveSessionOrder(order);
      return true;
    }
  } catch {}
  return false;
}

// --- BIMA+ HTTP CLIENT (CAPACITOR NATIVE + VITE DEV PROXY) ---

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
  const baseUrl = isNative ? 'https://bimaplus-api.ioh.co.id' : '/bima-api';

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

// --- INDOSAT MYIM3 HTTP CLIENT (CAPACITOR NATIVE + VITE DEV PROXY) ---

async function postIndosatEndpoint(
  endpointPath: string,
  payload: Record<string, any>,
  tokenId: string = '',
  authorization: string = DEFAULT_AUTH,
  deviceId: string = DEFAULT_DEVICE_ID,
  faiid: string = DEFAULT_FAIID,
  serviceKey: string = DEFAULT_SERVICE_KEY_INDOSAT
): Promise<{ data: any; headers: Record<string, string> }> {
  const bodyStr = JSON.stringify(payload);
  const uid = generateUid();
  const oauth = getSHA512EncryptedBody(tokenId, bodyStr);
  const hashParams = `parent$BROWSER$4.1$${tokenId}`;
  const hash = getSHA512Encrypted(uid, hashParams);

  const isNative = Capacitor.isNativePlatform();
  const baseUrl = isNative ? 'https://myim3api1.ioh.co.id' : '/indosat-api';

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'authorization': authorization || DEFAULT_AUTH,
    'x-imi-app-os': 'BROWSER',
    'x-imi-appversion': '4.1',
    'x-imi-channel': 'PORTAL',
    'x-imi-language': 'ID',
    'x-imi-version': '4.1',
    'x-devicename': 'Windows PC (Windows)',
    'x-deviceid': deviceId || DEFAULT_DEVICE_ID,
    'x-faiid': faiid || DEFAULT_FAIID,
    'x-imi-servicekey': serviceKey || DEFAULT_SERVICE_KEY_INDOSAT,
    'x-imi-tokenid': tokenId,
    'x-imi-oauth': oauth,
    'x-imi-hash': hash,
    'x-imi-uid': uid,
  };

  if (isNative) {
    headers['origin'] = 'https://myim3.ioh.co.id';
    headers['referer'] = 'https://myim3.ioh.co.id/';
    headers['user-agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';

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

// --- XL AXIATA HTTP CLIENT (CAPACITOR NATIVE + VITE DEV PROXY) ---

const XL_API_KEY = 'zAkj4SVtW3tjLuDjf56oyg==';

async function postXlEndpoint(
  endpointPath: string,
  payload: Record<string, any> = {},
  token: string = '',
  deviceId: string = ''
): Promise<{ data: any; headers: Record<string, string> }> {
  const isNative = Capacitor.isNativePlatform();
  const baseUrl = isNative ? 'https://api.myxl.xlaxiata.co.id/api/v8' : '/xl-api';

  const devId = deviceId || DEFAULT_DEVICE_ID;
  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'x-api-key': XL_API_KEY,
    'ax-request-id': requestId,
    'ax-request-at': new Date().toISOString(),
    'ax-device-id': devId,
    'ax-request-device': 'android',
    'ax-request-device-model': 'Samsung SM-G998B',
    'ax-substype': 'PREPAID',
  };

  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  if (isNative) {
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
      body: JSON.stringify(payload),
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

async function callTselEndpoint(
  endpointPath: string,
  method: 'GET' | 'POST' = 'GET',
  payload?: any,
  sessionLogin?: string,
  deviceId?: string
): Promise<{ data: any; headers: Record<string, string> }> {
  const isNative = Capacitor.isNativePlatform();
  const baseUrl = isNative ? 'https://www.telkomsel.com/api' : '/telkomsel-api/api';

  const devId = deviceId || 'ae4e1d6e-d60e-4ace-8620-81e38584869e';
  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'device-id': devId,
    'origin': 'https://www.telkomsel.com',
    'referer': 'https://www.telkomsel.com/',
  };

  if (sessionLogin) {
    headers['cookie'] = `sessionLogin=${sessionLogin}`;
    headers['x-session-login'] = sessionLogin;
  }

  if (isNative) {
    const res = await (method === 'POST' ? CapacitorHttp.post : CapacitorHttp.get)({
      url: `${baseUrl}${endpointPath}`,
      headers,
      data: payload,
    });
    const parsedData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return { data: parsedData, headers: res.headers || {} };
  } else {
    const res = await fetch(`${baseUrl}${endpointPath}`, {
      method,
      headers,
      body: method === 'POST' && payload ? JSON.stringify(payload) : undefined,
    });
    const parsedData = await res.json();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k.toLowerCase()] = v;
    });
    return { data: parsedData, headers: resHeaders };
  }
}

// --- UNIFIED MULTI-OPERATOR ACTIONS ---

/**
 * 1. Request OTP (Mendukung Tri & XL Live API + Simulasi Mock Telkomsel, Indosat, Smartfren)
 */
export async function requestOperatorOtp(
  operator: OperatorType,
  phone: string
): Promise<{ success: boolean; message: string; isMock?: boolean }> {
  if (OPERATORS[operator].isAvailable === false) {
    return {
      success: false,
      message: `Operator ${OPERATORS[operator].name} saat ini belum tersedia (belum dapat dikonfigurasi).`,
    };
  }

  const clean = formatPhoneNumber(phone);
  if (!clean || clean.length < 9) {
    return { success: false, message: 'Format nomor HP tidak valid (minimal 10 digit).' };
  }

  // Untuk Smartfren (Mock Mode)
  if (operator === 'smartfren') {
    await new Promise((r) => setTimeout(r, 500));
    localStorage.setItem(
      STORAGE_PENDING_OTP_KEY,
      JSON.stringify({
        operator,
        phone: clean,
        transid: `MOCK-${operator.toUpperCase()}-${Date.now()}`,
        isMock: true,
        createdAt: Date.now(),
      })
    );
    const opMeta = OPERATORS[operator];
    return {
      success: true,
      isMock: true,
      message: `[${opMeta.mode}] Simulasi SMS OTP dikirim ke ${clean}. Gunakan kode OTP: 123456 (atau 6 angka bebas).`,
    };
  }

  // Untuk Indosat (Live myIM3 IOH API)
  if (operator === 'indosat') {
    try {
      console.log(`[INDOSAT OTP] 📡 Mengirim request OTP ke ${clean}...`);
      const guestRes = await postIndosatEndpoint('/api/v2/token/guest', {}, '');
      const guestData = guestRes.data;

      if (guestData?.status !== '0' || !guestData?.data?.tokenid) {
        return {
          success: false,
          message: guestData?.message || 'Gagal menginisialisasi sesi tamu Indosat.',
        };
      }

      const guestTokenId = guestData.data.tokenid;
      const msisdn = toMsisdn62(clean);
      const otpRes = await postIndosatEndpoint(
        '/api/v2/otp/send/v1',
        { msisdn, action: 'register' },
        guestTokenId
      );
      const otpData = otpRes.data;

      if (otpData?.status !== '0' && otpData?.message?.toLowerCase() !== 'success') {
        return {
          success: false,
          message: otpData?.message || 'Gagal mengirim SMS OTP ke nomor Indosat tersebut.',
        };
      }

      const transid =
        otpData?.transid || otpData?.data?.transid || otpData?.data?.transId || otpData?.transId;

      if (!transid) {
        return {
          success: false,
          message: 'Server Indosat tidak mengembalikan Transaction ID (transid).',
        };
      }

      localStorage.setItem(
        STORAGE_PENDING_OTP_KEY,
        JSON.stringify({
          operator: 'indosat',
          phone: clean,
          transid,
          guestTokenId,
          isMock: false,
          createdAt: Date.now(),
        })
      );

      return {
        success: true,
        isMock: false,
        message: `Kode OTP resmi myIM3 berhasil dikirim via SMS ke ${clean}. Masukkan kode untuk login.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Terjadi gangguan jaringan saat meminta OTP Indosat.',
      };
    }
  }

  // Untuk Telkomsel (Live Web API)
  if (operator === 'telkomsel') {
    try {
      const isHalo = clean.startsWith('0811');
      const serviceType = isHalo ? 'HALO' : 'PREPAID';
      console.log(`[TSEL OTP] 📡 Mengirim request OTP Telkomsel (${serviceType}) ke ${clean}...`);
      const res = await callTselEndpoint('/auth/v1/tsel/otp/request', 'POST', {
        serviceType,
        msisdn: clean,
      });
      const data = res.data;
      console.log('[TSEL OTP] 📥 Respons:', data);
      if (data?.data?.signatureOtp) {
        localStorage.setItem(
          STORAGE_PENDING_OTP_KEY,
          JSON.stringify({
            operator: 'telkomsel',
            phone: clean,
            signatureOtp: data.data.signatureOtp,
            serviceType,
            isMock: false,
            createdAt: Date.now(),
          })
        );
        return {
          success: true,
          isMock: false,
          message: data?.message || `Kode OTP Telkomsel (${serviceType}) berhasil dikirim ke nomor ${clean}`,
        };
      }
      return {
        success: false,
        message: data?.message || 'Gagal meminta OTP dari server Telkomsel.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Terjadi gangguan jaringan saat meminta OTP Telkomsel.',
      };
    }
  }

  // Untuk XL Axiata (Live myXL API)
  if (operator === 'xl') {
    try {
      console.log(`[XL OTP] 📡 Mengirim request OTP ke ${clean}...`);
      const res = await postXlEndpoint('/auth/regist/request-otp', {
        msisdn: clean,
        requestFor: 'LOGIN',
      });
      const data = res.data;
      console.log('[XL OTP] 📥 Respons dari server myXL:', data);
      if (data?.status === 'SUCCESS' || data?.status === '0' || (data?.message && !data?.error)) {
        localStorage.setItem(
          STORAGE_PENDING_OTP_KEY,
          JSON.stringify({
            operator: 'xl',
            phone: clean,
            transid: `XL-${Date.now()}`,
            isMock: false,
            createdAt: Date.now(),
          })
        );
        return {
          success: true,
          isMock: false,
          message: data?.message || `Kode OTP XL berhasil dikirim ke nomor ${clean}`,
        };
      }
      return {
        success: false,
        message: data?.message || 'Gagal meminta OTP dari server XL.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Terjadi gangguan jaringan saat meminta OTP XL.',
      };
    }
  }

  // Untuk Tri (Live Bima+ API)
  try {
    const guestRes = await postBimaEndpoint('/api/v2/token/guest', {}, '');
    const guestData = guestRes.data;

    if (guestData?.status !== '0' || !guestData?.data?.tokenid) {
      return {
        success: false,
        message: guestData?.message || 'Gagal menginisialisasi sesi tamu Bima+.',
      };
    }

    const guestTokenId = guestData.data.tokenid;
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
        message: otpData?.message || 'Gagal mengirim SMS OTP ke nomor Tri tersebut.',
      };
    }

    const transid =
      otpData?.transid || otpData?.data?.transid || otpData?.data?.transId || otpData?.transId;

    if (!transid) {
      return {
        success: false,
        message: 'Server Tri tidak mengembalikan Transaction ID (transid).',
      };
    }

    localStorage.setItem(
      STORAGE_PENDING_OTP_KEY,
      JSON.stringify({
        operator: 'tri',
        phone: clean,
        transid,
        guestTokenId,
        isMock: false,
        createdAt: Date.now(),
      })
    );

    return {
      success: true,
      isMock: false,
      message: otpData?.message || `Kode OTP berhasil dikirim via SMS ke ${clean}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Terjadi gangguan jaringan saat meminta OTP Tri.',
    };
  }
}

/**
 * 2. Verify OTP & Simpan Sesi Multi-Operator
 */
export async function verifyOperatorOtp(
  operator: OperatorType,
  phone: string,
  otp: string
): Promise<{ success: boolean; message: string }> {
  if (OPERATORS[operator].isAvailable === false) {
    return {
      success: false,
      message: `Operator ${OPERATORS[operator].name} saat ini belum tersedia (belum dapat dikonfigurasi).`,
    };
  }

  const clean = formatPhoneNumber(phone);
  const cleanOtp = String(otp).trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return { success: false, message: 'Kode OTP harus terdiri dari 6 digit angka.' };
  }

  // Untuk Smartfren (Mock Mode)
  if (operator === 'smartfren') {
    await new Promise((r) => setTimeout(r, 450));
    saveSession({
      operator,
      phoneNumber: clean,
      authorization: `mock-${operator}-bearer`,
      tokenId: `mock-${operator}-token-${Date.now()}`,
      deviceId: DEFAULT_DEVICE_ID,
      faiid: DEFAULT_FAIID,
      serviceKey: DEFAULT_SERVICE_KEY,
      isMock: true,
      updatedAt: new Date().toISOString(),
    });
    localStorage.removeItem(STORAGE_PENDING_OTP_KEY);
    return {
      success: true,
      message: `Kartu ${OPERATORS[operator].shortName} (${clean}) berhasil dihubungkan!`,
    };
  }

  // Untuk Indosat (Live myIM3 IOH API)
  if (operator === 'indosat') {
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

      const verifyRes = await postIndosatEndpoint(
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
        operator: 'indosat',
        phoneNumber: clean,
        authorization: newAuth,
        tokenId: newTokenId,
        deviceId: DEFAULT_DEVICE_ID,
        faiid: DEFAULT_FAIID,
        serviceKey: DEFAULT_SERVICE_KEY_INDOSAT,
        isMock: false,
        updatedAt: new Date().toISOString(),
      });

      localStorage.removeItem(STORAGE_PENDING_OTP_KEY);

      return {
        success: true,
        message: `Kartu Indosat (${clean}) berhasil diverifikasi dan disimpan!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal memverifikasi OTP Indosat.',
      };
    }
  }

  // Untuk Telkomsel (Live Web API)
  if (operator === 'telkomsel') {
    try {
      const rawPending = localStorage.getItem(STORAGE_PENDING_OTP_KEY);
      if (!rawPending) {
        return {
          success: false,
          message: 'Sesi OTP tidak ditemukan. Silakan klik "Minta OTP" terlebih dahulu.',
        };
      }
      const pending = JSON.parse(rawPending);
      const signatureOtp = pending.signatureOtp;
      if (!signatureOtp) {
        return {
          success: false,
          message: 'Signature OTP tidak ditemukan. Silakan minta OTP ulang.',
        };
      }

      console.log(`[TSEL OTP] 🔑 Verifikasi OTP Telkomsel (${cleanOtp}) untuk ${clean}...`);
      const verifyRes = await callTselEndpoint('/auth/v1/tsel/otp/verify', 'POST', {
        signatureOtp,
        otp: cleanOtp,
      });
      const resData = verifyRes.data || {};
      const sessionLogin = resData.data?.sessionLogin;
      const xAccess = verifyRes.headers['x-access'] || '';

      if (sessionLogin) {
        saveSession({
          operator: 'telkomsel',
          phoneNumber: clean,
          authorization: xAccess ? `Bearer ${xAccess}` : sessionLogin,
          tokenId: sessionLogin,
          deviceId: 'ae4e1d6e-d60e-4ace-8620-81e38584869e',
          faiid: pending.serviceType || 'PREPAID',
          serviceKey: DEFAULT_SERVICE_KEY,
          isMock: false,
          updatedAt: new Date().toISOString(),
        });
        localStorage.removeItem(STORAGE_PENDING_OTP_KEY);
        return {
          success: true,
          message: `Kartu Telkomsel (${clean}) berhasil diverifikasi dan disimpan!`,
        };
      }

      return {
        success: false,
        message: resData.message || 'Kode OTP Telkomsel tidak valid atau kedaluwarsa.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal memverifikasi OTP Telkomsel.',
      };
    }
  }

  // Untuk XL Axiata (Live myXL API)
  if (operator === 'xl') {
    try {
      const verifyRes = await postXlEndpoint('/auth/regist/validate-otp', {
        msisdn: clean,
        otp: cleanOtp,
        requestFor: 'LOGIN',
      });
      const resData = verifyRes.data || {};
      const token =
        resData.token ||
        resData.accessToken ||
        resData.data?.token ||
        resData.data?.accessToken;

      if (token) {
        saveSession({
          operator: 'xl',
          phoneNumber: clean,
          authorization: `Bearer ${token}`,
          tokenId: token,
          deviceId: DEFAULT_DEVICE_ID,
          faiid: DEFAULT_FAIID,
          serviceKey: DEFAULT_SERVICE_KEY,
          isMock: false,
          updatedAt: new Date().toISOString(),
        });
        localStorage.removeItem(STORAGE_PENDING_OTP_KEY);
        return {
          success: true,
          message: `Kartu XL (${clean}) berhasil diverifikasi dan disimpan!`,
        };
      }

      return {
        success: false,
        message: resData.message || 'Kode OTP XL tidak valid atau kedaluwarsa.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal memverifikasi OTP XL.',
      };
    }
  }

  // Untuk Tri (Live Bima+ API)
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
      operator: 'tri',
      phoneNumber: clean,
      authorization: newAuth,
      tokenId: newTokenId,
      deviceId: DEFAULT_DEVICE_ID,
      faiid: DEFAULT_FAIID,
      serviceKey: DEFAULT_SERVICE_KEY,
      isMock: false,
      updatedAt: new Date().toISOString(),
    });

    localStorage.removeItem(STORAGE_PENDING_OTP_KEY);

    return {
      success: true,
      message: `Kartu Tri (${clean}) berhasil diverifikasi dan disimpan!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal memverifikasi OTP Tri.',
    };
  }
}

/**
 * 3. Login Cepat dengan Token Sesi
 */
export async function loginWithTokenId(
  operator: OperatorType,
  phone: string,
  tokenId: string
): Promise<{ success: boolean; message: string }> {
  const clean = formatPhoneNumber(phone);
  const cleanToken = String(tokenId).trim();

  if (!clean || clean.length < 9) {
    return { success: false, message: 'Masukkan nomor HP yang valid.' };
  }

  const isMock = operator !== 'tri' && operator !== 'xl' && operator !== 'telkomsel';
  if (operator === 'tri') {
    const status = checkTokenStatus(cleanToken, false);
    if (!status.isValid) {
      return {
        success: false,
        message: 'Token Tri tidak valid, berstatus GUEST, atau sudah kedaluwarsa.',
      };
    }
  }

  saveSession({
    operator,
    phoneNumber: clean,
    authorization:
      operator === 'xl' || operator === 'telkomsel' ? `Bearer ${cleanToken}` : DEFAULT_AUTH,
    tokenId: cleanToken || `mock-${operator}-token`,
    deviceId: DEFAULT_DEVICE_ID,
    faiid: DEFAULT_FAIID,
    serviceKey: DEFAULT_SERVICE_KEY,
    isMock,
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Token ${OPERATORS[operator].shortName} berhasil disimpan!`,
  };
}

/**
 * 4. Fetch Quota & Balance Berdasarkan Operator Akun
 */
export async function fetchOperatorDashboard(phone: string): Promise<MobileQuotaReport> {
  const clean = formatPhoneNumber(phone);
  const session = getSession(clean);

  if (!session) {
    throw new Error('Sesi kartu tidak ditemukan. Silakan login kembali.');
  }

  const nowTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // --- ADAPTER: TELKOMSEL (Live API + Mock Fallback) ---
  if (session.operator === 'telkomsel') {
    if (session.isMock) {
      await new Promise((r) => setTimeout(r, 400));
      const packages: PackageQuotaItem[] = [
        {
          name: 'Internet MAX Utama',
          remainingGB: 18.5,
          totalGB: 25.0,
          percentage: 74.0,
          expiresAt: '2026-12-15',
        },
        {
          name: 'Kuota Nonton (OMG!)',
          remainingGB: 5.2,
          totalGB: 10.0,
          percentage: 52.0,
          expiresAt: '2026-12-15',
        },
      ];
      const report: MobileQuotaReport = {
        operator: 'telkomsel',
        phoneNumber: clean,
        balance: 25000,
        activeUntil: '2026-12-15',
        totalRemainingGB: 23.7,
        totalInitialGB: 35.0,
        packages,
        fetchedAt: nowTime,
        isMock: true,
      };
      saveSession({ ...session, lastReport: report });
      return report;
    }

    try {
      const sessionLogin = session.tokenId;
      const devId = session.deviceId || 'ae4e1d6e-d60e-4ace-8620-81e38584869e';

      // 1. Fetch Profile (saldo, masa aktif/tagihan, tipe layanan)
      const profRes = await callTselEndpoint('/customer/v1/profile', 'GET', undefined, sessionLogin, devId);
      const profData = profRes.data?.data || {};
      const serviceType = profData.serviceType || session.faiid || 'PREPAID';
      const balance = profData.balance || 0;
      const activeUntil = profData.bill?.dueDate ? profData.bill.dueDate.slice(0, 10) : profData.billCycle?.endDate || '-';

      // 2. Fetch Active Bonuses (kuota paket internet, telepon, sms)
      const bonusRes = await callTselEndpoint(
        `/customer/v1/active-bonuses?serviceType=${encodeURIComponent(serviceType)}`,
        'GET',
        undefined,
        sessionLogin,
        devId
      );
      const bonusData = bonusRes.data?.data?.activeBonuses || {};

      const packages: PackageQuotaItem[] = [];
      let totalRemaining = 0;
      let totalInitial = 0;

      if (bonusData.internet) {
        const remGB = parseFloat(bonusData.internet.remaining) || 0;
        const totGB = parseFloat(bonusData.internet.total) || remGB;
        totalRemaining += remGB;
        totalInitial += totGB;
        packages.push({
          name: bonusData.internet.label || 'Kuota Internet Utama',
          remainingGB: remGB,
          totalGB: totGB,
          percentage: bonusData.internet.percentage ?? (totGB > 0 ? (remGB / totGB) * 100 : 0),
          expiresAt: activeUntil,
        });
      }

      if (bonusData.application && bonusData.application.total !== '0') {
        const remGB = parseFloat(bonusData.application.remaining) || 0;
        const totGB = parseFloat(bonusData.application.total) || remGB;
        if (totGB > 0) {
          totalRemaining += remGB;
          totalInitial += totGB;
        }
        packages.push({
          name: bonusData.application.label || 'Kuota Aplikasi',
          remainingGB: remGB,
          totalGB: totGB,
          percentage: bonusData.application.percentage || 0,
          expiresAt: activeUntil,
        });
      }

      if (bonusData.voice && bonusData.voice.remaining) {
        packages.push({
          name: `${bonusData.voice.label || 'Nelpon'}: ${bonusData.voice.remaining}`,
          remainingGB: 0,
          totalGB: 0,
          percentage: bonusData.voice.percentage || 100,
          expiresAt: activeUntil,
        });
      }

      if (bonusData.sms && bonusData.sms.remaining) {
        packages.push({
          name: `${bonusData.sms.label || 'SMS'}: ${bonusData.sms.remaining} SMS`,
          remainingGB: 0,
          totalGB: 0,
          percentage: bonusData.sms.percentage || 100,
          expiresAt: activeUntil,
        });
      }

      const report: MobileQuotaReport = {
        operator: 'telkomsel',
        phoneNumber: clean,
        balance,
        activeUntil,
        totalRemainingGB: Number(totalRemaining.toFixed(2)),
        totalInitialGB: Number(totalInitial.toFixed(2)),
        packages,
        fetchedAt: nowTime,
        isMock: false,
      };
      saveSession({ ...session, lastReport: report });
      return report;
    } catch (err: any) {
      console.error('[TSEL LIVE] Gagal memuat kuota Telkomsel:', err);
      throw new Error(err.message || 'Gagal memuat kuota Telkomsel');
    }
  }

  // --- LIVE ADAPTER: INDOSAT MYIM3 ---
  if (session.operator === 'indosat') {
    if (session.isMock) {
      await new Promise((r) => setTimeout(r, 400));
      const packages: PackageQuotaItem[] = [
        {
          name: 'Freedom Internet 50GB',
          remainingGB: 32.7,
          totalGB: 50.0,
          percentage: 65.4,
          expiresAt: '2026-12-05',
        },
      ];
      const report: MobileQuotaReport = {
        operator: 'indosat',
        phoneNumber: clean,
        balance: 45000,
        activeUntil: '2026-12-31',
        totalRemainingGB: 32.7,
        totalInitialGB: 50.0,
        packages,
        fetchedAt: nowTime,
        isMock: true,
      };
      saveSession({ ...session, lastReport: report });
      return report;
    }

    const tokenCheck = checkTokenStatus(session.tokenId, false);
    if (!tokenCheck.isValid) {
      throw new Error('Sesi token Indosat telah berakhir (Expired). Silakan login kembali.');
    }

    try {
      const res = await postIndosatEndpoint(
        '/api/v2/dashboard/get/v4',
        {},
        session.tokenId,
        session.authorization,
        session.deviceId,
        session.faiid,
        session.serviceKey || DEFAULT_SERVICE_KEY_INDOSAT
      );

      const resData = res.data;
      if (resData?.status !== '0' && resData?.message?.toLowerCase() !== 'success') {
        throw new Error(resData?.message || 'Gagal mengambil data dashboard dari myIM3.');
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
              } else if (q.quotaUnit === 'MB') {
                totGB = Number(((q.totalQuota || 0) / 1024).toFixed(2));
              } else if (q.quotaUnit === 'KB') {
                totGB = Number(((q.totalQuota || 0) / (1024 * 1024)).toFixed(2));
              }

              if (totGB === 0 && remGB > 0) {
                totGB = remGB;
              }

              const pct = totGB > 0 ? Math.min(100, Math.round((remGB / totGB) * 100)) : 0;

              packages.push({
                name: q.name || q.quotaName || packageName,
                remainingGB: remGB,
                totalGB: totGB,
                percentage: pct,
                expiresAt: exp || activeUntil,
              });
            }
          }
        } else {
          packages.push({
            name: packageName,
            remainingGB: 0,
            totalGB: 0,
            percentage: 0,
            expiresAt: exp || activeUntil,
          });
        }
      }

      const totalRemainingGB = Number(
        packages.reduce((sum, p) => sum + p.remainingGB, 0).toFixed(2)
      );
      const totalInitialGB = Number(packages.reduce((sum, p) => sum + p.totalGB, 0).toFixed(2));

      const report: MobileQuotaReport = {
        operator: 'indosat',
        phoneNumber: resolvedPhone,
        balance,
        activeUntil,
        totalRemainingGB,
        totalInitialGB,
        packages,
        fetchedAt: nowTime,
        isMock: false,
      };

      saveSession({ ...session, lastReport: report });
      return report;
    } catch (err: any) {
      throw new Error(`[Indosat] Gagal mengambil kuota: ${err.message}`);
    }
  }

  // --- MOCK ADAPTER: SMARTFREN ---
  if (session.operator === 'smartfren') {
    await new Promise((r) => setTimeout(r, 400));
    const packages: PackageQuotaItem[] = [
      {
        name: 'Smartfren Kuota Nonstop 45GB',
        remainingGB: 28.4,
        totalGB: 45.0,
        percentage: 63.1,
        expiresAt: '2026-12-28',
      },
      {
        name: 'Bonus Kuota Malam 15GB',
        remainingGB: 12.1,
        totalGB: 15.0,
        percentage: 80.7,
        expiresAt: '2026-12-28',
      },
    ];
    const report: MobileQuotaReport = {
      operator: 'smartfren',
      phoneNumber: clean,
      balance: 30000,
      activeUntil: '2026-12-31',
      totalRemainingGB: 40.5,
      totalInitialGB: 60.0,
      packages,
      fetchedAt: nowTime,
      isMock: true,
    };
    saveSession({ ...session, lastReport: report });
    return report;
  }

  // --- ADAPTER: XL AXIATA (LIVE API + MOCK FALLBACK) ---
  if (session.operator === 'xl') {
    if (session.isMock) {
      await new Promise((r) => setTimeout(r, 400));
      const packages: PackageQuotaItem[] = [
        {
          name: 'Xtra Combo Flex VIP',
          remainingGB: 24.5,
          totalGB: 30.0,
          percentage: 81.7,
          expiresAt: '2026-12-25',
        },
        {
          name: 'Bonus Kuota YouTube & TikTok',
          remainingGB: 6.2,
          totalGB: 10.0,
          percentage: 62.0,
          expiresAt: '2026-12-25',
        },
      ];
      const report: MobileQuotaReport = {
        operator: 'xl',
        phoneNumber: clean,
        balance: 35000,
        activeUntil: '2026-12-25',
        totalRemainingGB: 30.7,
        totalInitialGB: 40.0,
        packages,
        fetchedAt: nowTime,
        isMock: true,
      };
      saveSession({ ...session, lastReport: report });
      return report;
    }

    try {
      // 1. Fetch Pulsa & Masa Aktif
      const balRes = await postXlEndpoint(
        '/packages/balance-and-credit',
        {},
        session.tokenId,
        session.deviceId
      );
      const balData = balRes.data?.data || balRes.data || {};
      const balance = Number(balData.balance?.remaining || balData.balance || 0);
      const activeUntil = balData.balance?.expiredAt
        ? formatDate(balData.balance.expiredAt)
        : balData.graceEndDate
        ? formatDate(balData.graceEndDate)
        : '-';

      // 2. Fetch Quota Details
      const detailsRes = await postXlEndpoint(
        '/packages/quota-details',
        {},
        session.tokenId,
        session.deviceId
      );
      const detailsData = detailsRes.data?.data || detailsRes.data || [];
      const packages: PackageQuotaItem[] = [];

      if (Array.isArray(detailsData)) {
        for (const item of detailsData) {
          const remBytes = Number(item.remaining || 0);
          const totBytes = Number(item.total || remBytes);
          const remGB = Number((remBytes / 1024 ** 3).toFixed(2));
          const totGB = Number((totBytes / 1024 ** 3).toFixed(2));
          const pct = totGB > 0 ? Math.min(100, Math.round((remGB / totGB) * 1000) / 10) : 0;

          packages.push({
            name: item.quotaLabel || item.name || 'Paket Internet XL',
            remainingGB: remGB,
            totalGB: totGB,
            percentage: pct,
            expiresAt: item.expiredAt ? formatDate(item.expiredAt) : activeUntil,
          });
        }
      }

      // 3. Fallback to Quota Summary if empty
      if (packages.length === 0) {
        const sumRes = await postXlEndpoint(
          '/packages/quota-summary',
          {},
          session.tokenId,
          session.deviceId
        );
        const sumData = sumRes.data?.data?.quota || sumRes.data?.quota || {};
        const remBytes = Number(sumData.remaining || 0);
        const totBytes = Number(sumData.total || remBytes);
        const remGB = Number((remBytes / 1024 ** 3).toFixed(2));
        const totGB = Number((totBytes / 1024 ** 3).toFixed(2));
        const pct = totGB > 0 ? Math.min(100, Math.round((remGB / totGB) * 1000) / 10) : 0;

        packages.push({
          name: sumRes.data?.planType || 'Kuota Utama XL',
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
        operator: 'xl',
        phoneNumber: clean,
        balance,
        activeUntil,
        totalRemainingGB,
        totalInitialGB,
        packages,
        fetchedAt: nowTime,
        isMock: false,
      };

      saveSession({ ...session, lastReport: report });
      return report;
    } catch (err: any) {
      throw new Error(`Gagal mengambil data kuota XL: ${err.message}`);
    }
  }

  // --- LIVE ADAPTER: TRI BIMA+ ---
  const tokenCheck = checkTokenStatus(session.tokenId, false);
  if (!tokenCheck.isValid) {
    throw new Error('Sesi token Tri telah berakhir (Expired). Silakan login kembali.');
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
    operator: 'tri',
    phoneNumber: resolvedPhone,
    balance,
    activeUntil,
    totalRemainingGB,
    totalInitialGB,
    packages,
    fetchedAt: nowTime,
    isMock: false,
  };

  saveSession({
    ...session,
    phoneNumber: resolvedPhone,
    lastReport: report,
  });

  return report;
}

