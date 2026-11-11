import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

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

async function startApp(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 MEMULAI DEV SERVER & MEMBUKA JENDELA BROWSER...');
  console.log('====================================================\n');

  // 1. Inisialisasi Vite Server secara terprogram
  const viteServer = await createServer({
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    server: {
      port: 5173,
    },
  });

  await viteServer.listen();
  const address = viteServer.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}/`;
  console.log(`✅ Vite Server aktif di: ${url}`);

  // 2. Luncurkan Browser Visible via Puppeteer
  const executablePath = getBrowserExecutablePath();
  const uniqueSessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userDataDir = path.join(os.tmpdir(), `qm_browser_${uniqueSessionId}`);

  console.log(`🌐 Membuka Chrome UI di layar (${executablePath})...\n`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--new-window',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      `--app=${url}`,
    ],
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  // Pastikan window terfokus
  await page.bringToFront();

  console.log('🎯 Jendela Quota Monitor berhasil terbuka di layar desktop!');
  console.log('📡 Menunggu request OTP dari UI...\n');

  // 3. Monitor Console & Network secara Real-Time
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[XL OTP]') || text.includes('[XL API]') || text.includes('OTP')) {
      console.log(`🖥️  [BROWSER CONSOLE] ${text}`);
    }
  });

  page.on('response', async (res) => {
    const resUrl = res.url();
    if (resUrl.includes('request-otp') || resUrl.includes('validate-otp') || resUrl.includes('/otp/send') || resUrl.includes('/otp/validate')) {
      console.log(`\n====================================================`);
      console.log(`📥 [INTERCEPTED OTP RESPONSE]`);
      console.log(`URL: ${resUrl}`);
      console.log(`HTTP Status: ${res.status()}`);
      try {
        const body = await res.json();
        console.log(`Payload Body:`, JSON.stringify(body, null, 2));
      } catch {
        console.log(`Body (Text):`, (await res.text()).slice(0, 300));
      }
      console.log(`====================================================\n`);
    }
  });

  browser.on('disconnected', async () => {
    console.log('\n🚪 Browser ditutup oleh user. Mematikan server...');
    await viteServer.close();
    process.exit(0);
  });
}

startApp().catch((err) => {
  console.error('❌ Terjadi kesalahan:', err);
  process.exit(1);
});

