import dotenv from 'dotenv';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { OperatorAdapter, QuotaReport } from './types/index.js';
import { TelkomselAdapter } from './adapters/telkomsel.js';
import { TriAdapter } from './adapters/tri.js';
import { IndosatAdapter } from './adapters/indosat.js';
import { formatRupiah, formatPhoneNumber, formatDate } from './utils/format.js';
import { getSessionDetails } from './utils/session.js';
import {
  getRegisteredAccounts,
  addRegisteredAccount,
  removeRegisteredAccount,
  toggleAppMode,
  RegisteredAccount,
} from './utils/config.js';
import { startBrowserLogin } from './browser_login.js';

// Muat variabel environment
dotenv.config();

function getIsMock(): boolean {
  return (process.env.APP_MODE || 'live').toLowerCase() === 'mock';
}

/**
 * Membuat instance operator adapters berdasarkan nomor yang terdaftar di konfigurasi
 */
function buildAdapters(): OperatorAdapter[] {
  // Muat ulang env setiap kali adapter dibuat
  dotenv.config();
  const accounts = getRegisteredAccounts();
  const isMock = getIsMock();
  const adapters: OperatorAdapter[] = [];

  for (const acc of accounts) {
    if (acc.operator === 'telkomsel') {
      adapters.push(
        new TelkomselAdapter(acc.phoneNumber, process.env.TELKOMSEL_BEARER_TOKEN, isMock)
      );
    } else if (acc.operator === 'tri') {
      const auth = {
        authorization: process.env.TRI_BEARER_TOKEN || process.env.TRI_AUTHORIZATION || '642d1cc69d90666962726e',
      };
      adapters.push(new TriAdapter(acc.phoneNumber, auth, isMock));
    } else if (acc.operator === 'indosat') {
      adapters.push(
        new IndosatAdapter(acc.phoneNumber, process.env.INDOSAT_ACCESS_TOKEN, isMock)
      );
    }
  }

  return adapters;
}

/**
 * Menampilkan tabel kuota & pulsa dari seluruh nomor yang terdaftar
 */
async function displayQuotaReport(): Promise<void> {
  const adapters = buildAdapters();
  const isMock = getIsMock();

  console.log('\n====================================================');
  console.log('📊 STATUS KUOTA & PULSA OPERATOR SELULER');
  console.log(`🔧 Mode: ${isMock ? 'SIMULASI (MOCK DATA)' : 'LIVE API'}`);
  console.log('====================================================\n');

  if (adapters.length === 0) {
    console.log('ℹ️ Belum ada nomor yang terdaftar.');
    console.log('👉 Gunakan menu [2] Tambah Nomor Baru untuk menambahkan nomor telepon Anda.\n');
    return;
  }

  const reports: QuotaReport[] = [];

  for (const adapter of adapters) {
    try {
      process.stdout.write(`⏳ Memeriksa kuota untuk ${adapter.operator.toUpperCase()} (${adapter.phoneNumber})... `);
      const report = await adapter.checkQuota();
      reports.push(report);
      console.log('✅ Selesai');
    } catch (error: any) {
      console.log(`❌ Gagal: ${error.message}`);
      reports.push({
        operator: adapter.operator,
        phoneNumber: adapter.phoneNumber,
        balance: 0,
        activeUntil: 'ERROR',
        packages: [
          {
            name: `[Error: ${error.message}]`,
            remainingGB: 0,
            totalGB: 0,
            expiresAt: '-',
          },
        ],
      });
    }
  }

  // --- TABEL 1: RINGKASAN AKUN & SISA PULSA ---
  console.log('\n--- [RINGKASAN AKUN & SISA PULSA] ---');
  const summaryTable = reports.map((r) => {
    const isError = r.activeUntil === 'ERROR';
    const totalRemainingData = r.packages
      .reduce((sum, p) => sum + p.remainingGB, 0)
      .toFixed(2);

    return {
      'Operator': r.operator.toUpperCase(),
      'Nomor HP': formatPhoneNumber(r.phoneNumber),
      'Sisa Pulsa': isError ? '⚠️ Error / Expired' : formatRupiah(r.balance),
      'Masa Aktif': isError ? 'Perlu Login' : formatDate(r.activeUntil),
      'Total Sisa Kuota': isError ? '-' : `${totalRemainingData} GB`,
      'Jumlah Paket': isError ? 0 : r.packages.length,
    };
  });
  console.table(summaryTable);

  // --- TABEL 2: RINCIAN PAKET INTERNET AKTIF ---
  console.log('\n--- [RINCIAN PAKET INTERNET AKTIF] ---');
  const packagesTable: any[] = [];
  reports.forEach((r) => {
    r.packages.forEach((pkg) => {
      const pct =
        pkg.totalGB > 0
          ? ((pkg.remainingGB / pkg.totalGB) * 100).toFixed(1) + '%'
          : '0%';

      packagesTable.push({
        'Operator': r.operator.toUpperCase(),
        'Nomor HP': formatPhoneNumber(r.phoneNumber),
        'Nama Paket': pkg.name,
        'Sisa (GB)': `${pkg.remainingGB} GB`,
        'Total (GB)': `${pkg.totalGB} GB`,
        'Sisa': pct,
        'Kedaluwarsa': formatDate(pkg.expiresAt),
      });
    });
  });
  console.table(packagesTable);
  console.log('');
}

/**
 * Submenu: Tambah Nomor Baru
 */
async function handleAddNumber(rl: readline.Interface): Promise<void> {
  console.log('\n--- [TAMBAH NOMOR BARU] ---');
  console.log('Pilih Operator:');
  console.log('1. Tri (3 / Bima+)');
  console.log('2. Telkomsel (MyTelkomsel)');
  console.log('3. Indosat (myIM3)');
  console.log('0. Batal');

  const opChoice = await rl.question('\nPilih operator [0-3]: ');
  let operator: 'telkomsel' | 'tri' | 'indosat' | null = null;

  if (opChoice.trim() === '1') operator = 'tri';
  else if (opChoice.trim() === '2') operator = 'telkomsel';
  else if (opChoice.trim() === '3') operator = 'indosat';
  else return;

  const phoneInput = await rl.question(`Masukkan nomor ${operator.toUpperCase()} (cth: 0895... / 0812...): `);
  const clean = formatPhoneNumber(phoneInput.trim());

  if (!clean || clean.length < 9) {
    console.log('❌ Format nomor telepon tidak valid.\n');
    return;
  }

  const key = addRegisteredAccount(operator, clean);
  console.log(`✅ Nomor ${clean} (${operator.toUpperCase()}) berhasil ditambahkan ke ${key}!\n`);

  // Jika Tri, tawarkan opsi login langsung
  if (operator === 'tri') {
    const loginNow = await rl.question('Buka browser sekarang untuk langsung login akun ini? (Y/n): ');
    if (loginNow.trim().toLowerCase() !== 'n') {
      console.log('🚀 Membuka browser...');
      await startBrowserLogin(clean);
    }
  }
}

/**
 * Submenu: Hapus Nomor Terdaftar
 */
async function handleRemoveNumber(rl: readline.Interface): Promise<void> {
  const accounts = getRegisteredAccounts();
  if (accounts.length === 0) {
    console.log('\nℹ️ Tidak ada nomor yang terdaftar untuk dihapus.\n');
    return;
  }

  console.log('\n--- [HAPUS NOMOR TERDAFTAR] ---');
  accounts.forEach((acc, idx) => {
    console.log(`${idx + 1}. [${acc.operator.toUpperCase()}] ${acc.phoneNumber} (${acc.label})`);
  });
  console.log('0. Batal');

  const choice = await rl.question(`\nPilih nomor yang ingin dihapus [0-${accounts.length}]: `);
  const num = parseInt(choice.trim(), 10);

  if (isNaN(num) || num <= 0 || num > accounts.length) {
    return;
  }

  const target = accounts[num - 1];
  const confirm = await rl.question(`Yakin ingin menghapus nomor ${target.phoneNumber} (${target.operator.toUpperCase()})? (y/N): `);
  if (confirm.trim().toLowerCase() === 'y') {
    removeRegisteredAccount(target);
    console.log(`✅ Nomor ${target.phoneNumber} telah dihapus dari konfigurasi dan sesi lokal.\n`);
  }
}

/**
 * Submenu: Login / Session Manager Tri
 */
async function handleSessionManager(rl: readline.Interface): Promise<void> {
  const accounts = getRegisteredAccounts().filter((a) => a.operator === 'tri');
  if (accounts.length === 0) {
    console.log('\nℹ️ Belum ada nomor Tri yang terdaftar. Tambahkan nomor terlebih dahulu di menu [2].\n');
    return;
  }

  console.log('\n--- [LOGIN / STATUS SESI TRI BIMA+] ---');
  accounts.forEach((acc, idx) => {
    const sessionInfo = getSessionDetails(acc.phoneNumber);
    console.log(`${idx + 1}. ${acc.phoneNumber} -> Status: ${sessionInfo.statusText}`);
  });
  console.log('0. Kembali');

  const choice = await rl.question(`\nPilih nomor untuk login / perbarui sesi [0-${accounts.length}]: `);
  const num = parseInt(choice.trim(), 10);

  if (isNaN(num) || num <= 0 || num > accounts.length) {
    return;
  }

  const target = accounts[num - 1];
  console.log(`\nPilih Metode Login untuk ${target.phoneNumber}:`);
  console.log('1. 🌐 Buka Browser Chrome Otomatis (Recommended)');
  console.log('2. 📟 Kirim & Input OTP di Terminal');
  console.log('0. Batal');

  const method = await rl.question('Pilih metode [0-2]: ');
  if (method.trim() === '1') {
    console.log('🚀 Membuka browser...');
    await startBrowserLogin(target.phoneNumber);
  } else if (method.trim() === '2') {
    const adapter = new TriAdapter(target.phoneNumber, undefined, false);
    process.stdout.write(`⏳ Mengirim kode OTP ke nomor ${target.phoneNumber}... `);
    const sendRes = await adapter.loginWithOtp(target.phoneNumber);
    if (!sendRes.success) {
      console.log(`❌ Gagal: ${sendRes.message}\n`);
      return;
    }
    console.log('✅ Terkirim!');
    console.log(`📨 ${sendRes.message}`);

    const otpCode = await rl.question('👉 Masukkan 6 digit kode OTP yang diterima via SMS: ');
    process.stdout.write(`⏳ Memverifikasi kode OTP... `);
    const verifyRes = await adapter.loginWithOtp(target.phoneNumber, otpCode.trim());
    if (verifyRes.success) {
      console.log(`✅ Sukses!`);
      console.log(`🎉 ${verifyRes.message}\n`);
    } else {
      console.log(`❌ Gagal: ${verifyRes.message}\n`);
    }
  }
}

/**
 * Menu Utama Interaktif
 */
async function showMainMenu(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  while (true) {
    const isMock = getIsMock();
    const accounts = getRegisteredAccounts();

    console.log('======================================================');
    console.log('📱 MULTI-OPERATOR CELLULAR QUOTA MONITOR');
    console.log(`🔧 Mode: ${isMock ? 'SIMULASI (MOCK)' : 'LIVE API'} | Terdaftar: ${accounts.length} nomor`);
    console.log('======================================================');
    console.log('1. 📊 Cek & Tampilkan Kuota (Display All)');
    console.log('2. ➕ Tambah Nomor Baru (Add New Number)');
    console.log('3. 🔑 Login / Hubungkan Sesi Tri (Session Manager)');
    console.log('4. 🗑️  Hapus Nomor Terdaftar (Remove Number)');
    console.log(`5. ⚙️  Ganti Mode (Sekarang: ${isMock ? 'MOCK' : 'LIVE'})`);
    console.log('0. 🚪 Keluar (Exit)');
    console.log('======================================================');

    const choice = await rl.question('Pilih menu [0-5]: ');

    switch (choice.trim()) {
      case '1':
        await displayQuotaReport();
        break;
      case '2':
        await handleAddNumber(rl);
        break;
      case '3':
        await handleSessionManager(rl);
        break;
      case '4':
        await handleRemoveNumber(rl);
        break;
      case '5': {
        const newMode = toggleAppMode();
        console.log(`\n🔄 Mode berhasil diubah menjadi: ${newMode.toUpperCase()}\n`);
        break;
      }
      case '0':
        console.log('\n👋 Terima kasih! Sampai jumpa.\n');
        rl.close();
        return;
      default:
        console.log('\n⚠️ Pilihan tidak valid, silakan coba lagi.\n');
    }
  }
}

async function main() {
  // Jika dipanggil dengan flag otomatis --check / --now
  if (process.argv.includes('--check') || process.argv.includes('--now')) {
    await displayQuotaReport();
    return;
  }

  // Jika dipanggil dengan flag --browser
  if (process.argv.includes('--browser')) {
    const phone = process.argv[3];
    await startBrowserLogin(phone);
    return;
  }

  // Masuk ke Menu Interaktif
  await showMainMenu();
}

main().catch((err) => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
