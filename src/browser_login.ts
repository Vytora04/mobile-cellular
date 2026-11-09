import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { formatPhoneNumber } from './utils/format.js';
import { saveTriSession } from './utils/session.js';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function getBrowserExecutablePath(): string {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error('Tidak dapat menemukan Google Chrome atau Microsoft Edge di lokasi standar.');
}

export async function startBrowserLogin(targetPhone?: string): Promise<boolean> {
  const executablePath = getBrowserExecutablePath();
  const isDirectCli = process.argv[1]?.includes('browser_login');

  console.log('====================================================');
  console.log('🌐 BIMA+ BROWSER LOGIN & NETWORK INSPECTOR');
  console.log('====================================================\n');
  console.log(`🚀 Membuka browser: ${executablePath}`);
  console.log('📌 Halaman login Bima+ Tri akan dibuka secara otomatis.');
  console.log('👉 Masukkan kode OTP saat diminta di halaman web browser.');
  console.log('⏳ Menunggu aktivitas login & menangkap token...\n');

  const uniqueSessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userDataDir = path.join(os.tmpdir(), `bima_login_profile_${uniqueSessionId}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--new-window',
      '--incognito',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  // Pastikan cookies dan cache browser benar-benar bersih sejak awal
  try {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
  } catch {}

  let capturedMsisdn: string = targetPhone ? formatPhoneNumber(targetPhone) : '';
  let isCaptured = false;

  return new Promise<boolean>((resolve) => {
    // Monitor network requests & responses
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('bimaplus-api.ioh.co.id')) {
        const headers = req.headers();
        const tokenId = headers['x-imi-tokenid'];
        const auth = headers['authorization'];

        // Jika memanggil dashboard atau profile, tangkap kredensial request
        if (url.includes('/dashboard/get') || url.includes('/profile/get')) {
          if (tokenId && tokenId.startsWith('ey') && !headers['x-imi-tokenid']?.includes('GUEST')) {
            const authConfig = {
              authorization: auth || '642d1cc69d90666962726e',
              tokenId: tokenId,
              deviceId: headers['x-deviceid'] || '117178975203478994b3fb1a4b555cea',
              faiid: headers['x-faiid'] || 'dS576wMV4B4rhwhOuIKd0B',
              serviceKey: headers['x-imi-servicekey'] || 'FPi7ZP3Jy8Uv3KBd4QeG',
            };

            if (capturedMsisdn) {
              saveTriSession(capturedMsisdn, authConfig);
            }
          }
        }
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('bimaplus-api.ioh.co.id')) {
        try {
          const contentType = res.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const json = await res.json();

            // 1. Tangkap response dari OTP send (mencari MSISDN)
            if (url.includes('/otp/send')) {
              console.log('📨 Request OTP terdeteksi di portal Bima+...');
              const postData = res.request().postData();
              if (postData) {
                try {
                  const parsed = JSON.parse(postData);
                  if (parsed.msisdn) {
                    capturedMsisdn = formatPhoneNumber(parsed.msisdn);
                    console.log(`📱 Nomor telepon target: ${capturedMsisdn}`);
                  }
                } catch {}
              }
            }

            // 2. Tangkap response dari OTP validate
            if (url.includes('/otp/validate') && json.status === '0') {
              console.log('✅ Verifikasi OTP berhasil di browser!');
              const reqHeaders = res.request().headers();
              const data = json.data || {};
              const tokenId = data.tokenid || data.token || reqHeaders['x-imi-tokenid'];
              const auth = data.secret_token || reqHeaders['authorization'] || '642d1cc69d90666962726e';

              if (tokenId && capturedMsisdn) {
                const authConfig = {
                  authorization: auth,
                  tokenId,
                  deviceId: reqHeaders['x-deviceid'],
                  faiid: reqHeaders['x-faiid'],
                  serviceKey: reqHeaders['x-imi-servicekey'],
                };
                saveTriSession(capturedMsisdn, authConfig);
                console.log(`🎉 Sesi berhasil disimpan untuk ${capturedMsisdn}!`);
                isCaptured = true;
              }
            }

            // 3. Tangkap response dari dashboard
            if (url.includes('/dashboard/get/v4') && json.status === '0') {
              const reqHeaders = res.request().headers();
              const data = json.data || {};
              const msisdn = formatPhoneNumber(data.msisdn || data.packdata?.msisdn || capturedMsisdn);
              const tokenId = reqHeaders['x-imi-tokenid'];
              const auth = reqHeaders['authorization'] || '642d1cc69d90666962726e';

              if (msisdn && tokenId) {
                capturedMsisdn = msisdn;
                const authConfig = {
                  authorization: auth,
                  tokenId,
                  deviceId: reqHeaders['x-deviceid'],
                  faiid: reqHeaders['x-faiid'],
                  serviceKey: reqHeaders['x-imi-servicekey'],
                };
                saveTriSession(msisdn, authConfig);
                console.log(`🎉 Sesi aktif Bima+ berhasil ditangkap untuk ${msisdn}!`);
                console.log(`💰 Sisa Pulsa: Rp ${(data.prepaidinfo?.balance || 0).toLocaleString('id-ID')}`);
                isCaptured = true;

                // Beri jeda 2 detik lalu tutup browser
                setTimeout(async () => {
                  console.log('\n✨ Kredensial telah disimpan ke session_tri.json. Menutup browser...');
                  try {
                    await browser.close();
                  } catch {}
                  resolve(true);
                  if (isDirectCli) {
                    process.exit(0);
                  }
                }, 2000);
              }
            }
          }
        } catch {}
      }
    });

    // Arahkan ke halaman login portal Bima+
    page.goto('https://bimatri.ioh.co.id/login', {
      waitUntil: 'networkidle2',
    }).catch(() => {});

    // Jika user menutup browser manual
    browser.on('disconnected', () => {
      // Bersihkan direktori profil sementara
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch {}

      if (isCaptured) {
        console.log('\n✅ Browser ditutup. Sesi login telah tersimpan di session_tri.json.');
      } else {
        console.log('\n⚠️ Browser ditutup sebelum login selesai.');
      }
      resolve(isCaptured);
      if (isDirectCli) {
        process.exit(0);
      }
    });
  });
}

// Jika dijalankan langsung dari CLI
if (process.argv[1]?.includes('browser_login')) {
  const phoneArg = process.argv[2];
  startBrowserLogin(phoneArg).catch((err) => {
    console.error('❌ Terjadi kesalahan:', err);
    process.exit(1);
  });
}

