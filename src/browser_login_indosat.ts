import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

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

export async function startIndosatBrowserLogin(targetPhone?: string): Promise<boolean> {
  const executablePath = getBrowserExecutablePath();

  console.log('====================================================');
  console.log('🟡 MYIM3 INDOSAT BROWSER LOGIN & NETWORK INSPECTOR');
  console.log('====================================================\n');
  console.log(`🚀 Meluncurkan browser: ${executablePath}`);
  console.log('📌 Membuka https://myim3.ioh.co.id/ ...');
  console.log('👉 Masukkan nomor Indosat & kode OTP di jendela browser yang terbuka.');
  console.log('🔍 Inspector aktif di latar belakang merekam sesi login & token...\n');

  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFilePath = path.join(logDir, 'indosat_network.jsonl');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  function logToFile(data: any) {
    try {
      logStream.write(JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + '\n');
    } catch {}
  }

  const uniqueSessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userDataDir = path.join(os.tmpdir(), `myim3_login_profile_${uniqueSessionId}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--new-window',
      '--no-sandbox',
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  let capturedMsisdn: string = targetPhone || '';
  let capturedToken: string = '';
  let isCaptured = false;

  return new Promise<boolean>((resolve) => {
    // Monitor Requests
    page.on('request', (req) => {
      const url = req.url();
      const method = req.method();
      const resourceType = req.resourceType();

      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        return;
      }

      const isRelevant =
        url.includes('ioh.co.id') ||
        url.includes('indosat') ||
        url.includes('myim3') ||
        url.includes('otp') ||
        url.includes('login') ||
        url.includes('token') ||
        url.includes('profile') ||
        url.includes('dashboard');

      if (isRelevant) {
        const postData = req.postData();
        const headers = req.headers();

        console.log(`\n📤 [REQ] ${method} ${url}`);
        if (postData) {
          console.log(`   📦 Payload: ${postData.slice(0, 300)}`);
          try {
            const parsed = JSON.parse(postData);
            if (parsed.msisdn && !capturedMsisdn) {
              capturedMsisdn = String(parsed.msisdn);
              console.log(`   📱 Nomor HP terdeteksi: ${capturedMsisdn}`);
            }
          } catch {}
        }

        const tokenId = headers['x-imi-tokenid'];
        const auth = headers['authorization'];
        if (tokenId && !tokenId.includes('GUEST')) {
          capturedToken = tokenId;
          console.log(`   🔑 Token ID: ${tokenId.slice(0, 40)}...`);
        }

        logToFile({
          type: 'request',
          method,
          url,
          headers,
          postData,
        });
      }
    });

    // Monitor Responses
    page.on('response', async (res) => {
      const url = res.url();
      const status = res.status();
      const resourceType = res.request().resourceType();

      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        return;
      }

      const isRelevant =
        url.includes('ioh.co.id') ||
        url.includes('indosat') ||
        url.includes('myim3') ||
        url.includes('otp') ||
        url.includes('login') ||
        url.includes('token') ||
        url.includes('profile') ||
        url.includes('dashboard');

      if (isRelevant) {
        let bodyText = '';
        try {
          const ct = res.headers()['content-type'] || '';
          if (ct.includes('application/json') || ct.includes('text')) {
            bodyText = await res.text();
          }
        } catch {}

        console.log(`📥 [RES ${status}] ${url}`);
        if (bodyText) {
          const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
          console.log(`   📄 Body: ${preview}`);

          try {
            const json = JSON.parse(bodyText);

            // Cek response verifikasi OTP
            if (url.includes('otp') && (json.status === '0' || json.code === '00000')) {
              console.log('\n🎉 Verifikasi OTP Indosat Berhasil!');
              const data = json.data || {};
              const tId = data.tokenid || data.token || data.jwt_token;
              if (tId) {
                capturedToken = tId;
                console.log(`🔑 Token Berhasil Ditangkap: ${capturedToken.slice(0, 45)}...`);
              }
            }

            // Cek response dashboard / profile
            if ((url.includes('dashboard') || url.includes('profile')) && (json.status === '0' || json.code === '00000')) {
              const data = json.data || {};
              const msisdn = data.msisdn || data.packdata?.msisdn || capturedMsisdn;
              const balance = data.prepaidinfo?.balance ?? data.balance ?? 0;
              const expired = data.prepaidinfo?.expired ?? data.expired_date ?? '-';

              console.log('\n====================================================');
              console.log('✨ DATA AKUN INDOSAT BERHASIL DITANGKAP!');
              console.log('====================================================');
              console.log(`📱 Nomor HP     : ${msisdn || '-'}`);
              console.log(`💰 Sisa Pulsa   : Rp ${Number(balance).toLocaleString('id-ID')}`);
              console.log(`📅 Masa Aktif   : ${expired}`);

              const reqHeaders = res.request().headers();
              const authConfig = {
                operator: 'indosat',
                phoneNumber: msisdn || capturedMsisdn,
                authorization: reqHeaders['authorization'] || '642d1cc69d90666962726e',
                tokenId: capturedToken || reqHeaders['x-imi-tokenid'] || '',
                deviceId: reqHeaders['x-deviceid'] || '117178975203478994b3fb1a4b555cea',
                faiid: reqHeaders['x-faiid'] || 'dS576wMV4B4rhwhOuIKd0B',
                serviceKey: reqHeaders['x-imi-servicekey'] || 'i4WxFMMLvWqnrvuAyg58',
                updatedAt: new Date().toISOString(),
              };

              fs.writeFileSync(
                path.join(process.cwd(), 'session_indosat.json'),
                JSON.stringify(authConfig, null, 2),
                'utf-8'
              );
              console.log('💾 Sesi disimpan ke file: session_indosat.json\n');
              isCaptured = true;
            }
          } catch {}
        }

        logToFile({
          type: 'response',
          status,
          url,
          headers: res.headers(),
          body: bodyText ? (bodyText.length > 5000 ? bodyText.slice(0, 5000) : bodyText) : undefined,
        });
      }
    });

    // Buka halaman utama myIM3 (SPA akan memuat dan merender form login)
    page.goto('https://myim3.ioh.co.id/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }).catch((err) => {
      console.log(`⚠️ Info navigasi: ${err.message}`);
    });

    browser.on('disconnected', () => {
      console.log('\n🛑 Browser ditutup oleh pengguna.');
      logStream.end();
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch {}
      resolve(isCaptured);
    });
  });
}

// Eksekusi jika dijalankan langsung via CLI
if (process.argv[1]?.includes('browser_login_indosat')) {
  const phoneArg = process.argv[2];
  startIndosatBrowserLogin(phoneArg).catch((err) => {
    console.error('❌ Gagal menjalankan inspector Indosat:', err);
    process.exit(1);
  });
}

