import fs from 'node:fs';
import path from 'node:path';
import { formatPhoneNumber } from './format.js';
import { clearPendingOtpSession } from './session.js';

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');
const SESSION_FILE_PATH = path.resolve(process.cwd(), 'session_tri.json');

export interface RegisteredAccount {
  operator: 'telkomsel' | 'tri' | 'indosat';
  phoneNumber: string;
  envKey: string;
  label: string;
}

/**
 * Membaca file .env mentah dalam bentuk key-value pairs yang mempertahankan komentar & urutan
 */
function readEnvRaw(): string {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return '';
  }
  return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
}

/**
 * Menyimpan string mentah ke file .env
 */
function writeEnvRaw(content: string): void {
  fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');
}

/**
 * Memperbarui nilai variabel tertentu di file .env
 */
export function updateEnvVariable(key: string, value: string): void {
  let content = readEnvRaw();
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  }
  writeEnvRaw(content);
  process.env[key] = value;
}

/**
 * Menghapus variabel tertentu dari file .env
 */
export function removeEnvVariable(key: string): void {
  let content = readEnvRaw();
  const regex = new RegExp(`^${key}=.*(\r?\n)?`, 'gm');
  content = content.replace(regex, '');
  writeEnvRaw(content);
  delete process.env[key];
}

/**
 * Mengambil daftar seluruh nomor yang terdaftar di konfigurasi .env
 */
export function getRegisteredAccounts(): RegisteredAccount[] {
  const accounts: RegisteredAccount[] = [];

  // 1. Telkomsel
  const tselPhone = process.env.TELKOMSEL_PHONE_NUMBER;
  if (tselPhone && tselPhone.trim()) {
    accounts.push({
      operator: 'telkomsel',
      phoneNumber: formatPhoneNumber(tselPhone),
      envKey: 'TELKOMSEL_PHONE_NUMBER',
      label: 'Telkomsel',
    });
  }

  // 2. Tri (Akun 1 s/d 10)
  const tri1 = process.env.TRI_PHONE_NUMBER || process.env.TRI_1_PHONE_NUMBER;
  if (tri1 && tri1.trim()) {
    accounts.push({
      operator: 'tri',
      phoneNumber: formatPhoneNumber(tri1),
      envKey: process.env.TRI_PHONE_NUMBER ? 'TRI_PHONE_NUMBER' : 'TRI_1_PHONE_NUMBER',
      label: 'Tri (Akun 1)',
    });
  }

  for (let i = 2; i <= 10; i++) {
    const triN = process.env[`TRI_${i}_PHONE_NUMBER`];
    if (triN && triN.trim()) {
      accounts.push({
        operator: 'tri',
        phoneNumber: formatPhoneNumber(triN),
        envKey: `TRI_${i}_PHONE_NUMBER`,
        label: `Tri (Akun ${i})`,
      });
    }
  }

  // 3. Indosat
  const isatPhone = process.env.INDOSAT_PHONE_NUMBER;
  if (isatPhone && isatPhone.trim()) {
    accounts.push({
      operator: 'indosat',
      phoneNumber: formatPhoneNumber(isatPhone),
      envKey: 'INDOSAT_PHONE_NUMBER',
      label: 'Indosat (IM3)',
    });
  }

  return accounts;
}

/**
 * Menambahkan nomor baru ke .env
 */
export function addRegisteredAccount(operator: 'telkomsel' | 'tri' | 'indosat', phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);

  if (operator === 'telkomsel') {
    updateEnvVariable('TELKOMSEL_PHONE_NUMBER', cleanPhone);
    return 'TELKOMSEL_PHONE_NUMBER';
  } else if (operator === 'indosat') {
    updateEnvVariable('INDOSAT_PHONE_NUMBER', cleanPhone);
    return 'INDOSAT_PHONE_NUMBER';
  } else {
    // Operator Tri: cek slot pertama yang kosong
    if (!process.env.TRI_PHONE_NUMBER && !process.env.TRI_1_PHONE_NUMBER) {
      updateEnvVariable('TRI_PHONE_NUMBER', cleanPhone);
      return 'TRI_PHONE_NUMBER';
    }

    for (let i = 2; i <= 10; i++) {
      if (!process.env[`TRI_${i}_PHONE_NUMBER`]) {
        const key = `TRI_${i}_PHONE_NUMBER`;
        updateEnvVariable(key, cleanPhone);
        return key;
      }
    }

    // Default overwrite slot 1 jika penuh
    updateEnvVariable('TRI_PHONE_NUMBER', cleanPhone);
    return 'TRI_PHONE_NUMBER';
  }
}

/**
 * Menghapus nomor dari .env dan membersihkan session_tri.json jika ada
 */
export function removeRegisteredAccount(account: RegisteredAccount): void {
  removeEnvVariable(account.envKey);

  // Jika nomor Tri, bersihkan juga dari session_tri.json
  if (account.operator === 'tri') {
    try {
      if (fs.existsSync(SESSION_FILE_PATH)) {
        const raw = fs.readFileSync(SESSION_FILE_PATH, 'utf-8');
        const sessions = JSON.parse(raw);
        if (sessions[account.phoneNumber]) {
          delete sessions[account.phoneNumber];
          fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(sessions, null, 2), 'utf-8');
        }
      }
      clearPendingOtpSession(account.phoneNumber);
    } catch {}
  }
}

/**
 * Mengganti Mode Aplikasi (LIVE <-> MOCK)
 */
export function toggleAppMode(): string {
  const currentMode = (process.env.APP_MODE || 'live').toLowerCase();
  const newMode = currentMode === 'live' ? 'mock' : 'live';
  updateEnvVariable('APP_MODE', newMode);
  return newMode;
}

