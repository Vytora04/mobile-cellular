import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function startTelkomselInspector(): Promise<void> {
  console.log('====================================================');
  console.log('🔴 MYTELKOMSEL BROWSER LOGIN & NETWORK INSPECTOR');
  console.log('====================================================\n');
  console.log(`🚀 Meluncurkan Google Chrome: ${CHROME_PATH}`);
  console.log('📌 Membuka https://my.telkomsel.com/ ...');
  console.log('👉 Silakan masukkan nomor Telkomsel & kode OTP langsung di jendela Chrome yang terbuka.');
  console.log('🔍 Inspector aktif di latar belakang merekam seluruh request, header, dan response...\n');

  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFilePath = path.join(logDir, 'telkomsel_network.jsonl');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  function logToFile(data: any) {
    try {
      logStream.write(JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + '\n');
    } catch {}
  }

  const uniqueSessionId = `${Date.now()}`;
  const userDataDir = path.join(os.tmpdir(), `tsel_profile_${uniqueSessionId}`);

  // Launch browser with automation enabled so user sees the automation banner
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
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

  // Listen to requests
  page.on('request', (req) => {
    const url = req.url();
    const method = req.method();
    const resourceType = req.resourceType();

    // Skip static assets to keep console clean
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      return;
    }

    const postData = req.postData();
    const headers = req.headers();

    const isApi = url.includes('telkomsel') || url.includes('api') || url.includes('tsel') || url.includes('auth');
    if (isApi) {
      console.log(`\n📤 [REQ] ${method} ${url}`);
      if (postData) {
        console.log(`   📦 Payload: ${postData.slice(0, 300)}`);
      }
      if (headers['authorization']) {
        console.log(`   🔑 Authorization: ${headers['authorization'].slice(0, 50)}...`);
      }
      logToFile({
        type: 'request',
        url,
        method,
        headers,
        postData,
      });
    }
  });

  // Listen to responses
  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    const resourceType = res.request().resourceType();

    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      return;
    }

    const isApi = url.includes('telkomsel') || url.includes('api') || url.includes('tsel') || url.includes('auth');
    if (isApi) {
      let bodyText = '';
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json') || ct.includes('text')) {
          bodyText = await res.text();
        }
      } catch {}

      console.log(`📥 [RES ${status}] ${url}`);
      if (bodyText && bodyText.length > 0) {
        const preview = bodyText.length > 300 ? bodyText.slice(0, 300) + '...' : bodyText;
        console.log(`   📄 Body: ${preview}`);
      }

      logToFile({
        type: 'response',
        url,
        status,
        headers: res.headers(),
        body: bodyText ? (bodyText.length > 5000 ? bodyText.slice(0, 5000) : bodyText) : undefined,
      });
    }
  });

  try {
    await page.goto('https://www.telkomsel.com/login/select-service', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (err: any) {
    console.log(`⚠️ Info navigasi: ${err.message}`);
  }

  console.log('\n🟢 Halaman MyTelkomsel telah terbuka!');
  console.log('👉 Silakan lakukan login & verifikasi OTP sekarang.');
  console.log('Tekan Ctrl+C di terminal ini atau tutup jendela browser jika sudah selesai.\n');

  await new Promise<void>((resolve) => {
    browser.on('disconnected', () => {
      console.log('\n🛑 Browser ditutup oleh pengguna.');
      logStream.end();
      try {
        if (fs.existsSync(userDataDir)) {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        }
      } catch {}
      resolve();
    });
  });
}

// Eksekusi
startTelkomselInspector().catch((err) => {
  console.error('❌ Gagal menjalankan inspector Telkomsel:', err);
  process.exit(1);
});

