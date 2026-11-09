import fs from 'node:fs';
import path from 'node:path';
import { TriAuthConfig } from '../adapters/tri.js';
import { formatPhoneNumber } from './format.js';

const SESSION_FILE_PATH = path.resolve(process.cwd(), 'session_tri.json');

export interface StoredTriSession extends TriAuthConfig {
  phoneNumber: string;
  updatedAt: string;
  pendingTransId?: string;
  pendingGuestTokenId?: string;
}

/**
 * Memeriksa apakah token JWT merupakan token user resmi yang aktif (bukan guest dan belum expired)
 */
export function isUserSessionToken(token?: string): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    
    // Tolak jika bertipe GUEST
    if (payload.utype === 'GUEST' || payload.autp === 'GUEST' || payload.logintype === 'GUEST') {
      return false;
    }
    
    // Periksa waktu kedaluwarsa jika ada
    if (payload.exp && typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec >= payload.exp) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function loadAllTriSessions(): Record<string, StoredTriSession> {
  try {
    if (!fs.existsSync(SESSION_FILE_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

export function getTriSession(phoneNumber: string): TriAuthConfig | null {
  const normalized = formatPhoneNumber(phoneNumber);
  const allSessions = loadAllTriSessions();
  const session = allSessions[normalized];

  if (!session) return null;

  // Pastikan token adalah session user valid
  if (!session.tokenId && !session.authorization) return null;

  return {
    authorization: session.authorization,
    tokenId: session.tokenId,
    oauth: session.oauth,
    hash: session.hash,
    uid: session.uid,
    deviceId: session.deviceId,
    faiid: session.faiid,
    serviceKey: session.serviceKey,
  };
}

export function saveTriSession(phoneNumber: string, config: TriAuthConfig): void {
  const normalized = formatPhoneNumber(phoneNumber);
  const allSessions = loadAllTriSessions();
  const existing = allSessions[normalized] || {};

  allSessions[normalized] = {
    ...existing,
    phoneNumber: normalized,
    authorization: config.authorization,
    tokenId: config.tokenId,
    oauth: config.oauth,
    hash: config.hash,
    uid: config.uid,
    deviceId: config.deviceId,
    faiid: config.faiid,
    serviceKey: config.serviceKey,
    updatedAt: new Date().toISOString(),
  };

  // Bersihkan data pending saat sesi resmi tersimpan
  delete allSessions[normalized].pendingTransId;
  delete allSessions[normalized].pendingGuestTokenId;

  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(allSessions, null, 2), 'utf-8');
}

export function savePendingOtpSession(
  phoneNumber: string,
  transId: string,
  guestTokenId?: string
): void {
  const normalized = formatPhoneNumber(phoneNumber);
  const allSessions = loadAllTriSessions();
  const existing = allSessions[normalized] || {};

  allSessions[normalized] = {
    ...existing,
    phoneNumber: normalized,
    updatedAt: new Date().toISOString(),
    pendingTransId: transId,
    pendingGuestTokenId: guestTokenId,
  };

  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(allSessions, null, 2), 'utf-8');
}

export function getPendingOtpSession(
  phoneNumber: string
): { transId: string | null; guestTokenId: string | null } {
  const normalized = formatPhoneNumber(phoneNumber);
  const allSessions = loadAllTriSessions();
  const session = allSessions[normalized];
  return {
    transId: session?.pendingTransId || null,
    guestTokenId: session?.pendingGuestTokenId || null,
  };
}

export function clearPendingOtpSession(phoneNumber: string): void {
  const normalized = formatPhoneNumber(phoneNumber);
  const allSessions = loadAllTriSessions();
  if (allSessions[normalized]) {
    delete allSessions[normalized].pendingTransId;
    delete allSessions[normalized].pendingGuestTokenId;
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(allSessions, null, 2), 'utf-8');
  }
}

export function hasValidTriSession(phoneNumber: string): boolean {
  const session = getTriSession(phoneNumber);
  if (!session) return false;
  return isUserSessionToken(session.tokenId);
}

export function getSessionDetails(phoneNumber: string): {
  isValid: boolean;
  expiresAt?: string;
  statusText: string;
} {
  const session = getTriSession(phoneNumber);
  if (!session || !session.tokenId) {
    return { isValid: false, statusText: '🔴 Belum Login' };
  }
  try {
    const parts = session.tokenId.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      if (payload.utype === 'GUEST' || payload.autp === 'GUEST') {
        return { isValid: false, statusText: '🔴 Belum Login (Guest Token)' };
      }
      if (payload.exp && typeof payload.exp === 'number') {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        if (now >= expDate) {
          return { isValid: false, statusText: `🔴 Kedaluwarsa (${expDate.toLocaleDateString('id-ID')})` };
        }
        return {
          isValid: true,
          expiresAt: expDate.toLocaleDateString('id-ID'),
          statusText: `🟢 Aktif (s/d ${expDate.toLocaleDateString('id-ID')} ${expDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`,
        };
      }
    }
  } catch {}
  return {
    isValid: isUserSessionToken(session.tokenId),
    statusText: isUserSessionToken(session.tokenId) ? '🟢 Aktif' : '🔴 Tidak Valid',
  };
}
