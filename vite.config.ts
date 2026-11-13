import { defineConfig, Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

function localSessionsPlugin(): Plugin {
  return {
    name: 'local-sessions-plugin',
    configureServer(server) {
      server.middlewares.use('/api/local-sessions', (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const phoneParam = urlObj.searchParams.get('phone');

          if (req.method === 'DELETE' && phoneParam) {
            const clean = phoneParam.replace(/\D/g, '');
            const msisdn62 = clean.startsWith('0') ? '62' + clean.slice(1) : clean;
            const phone08 = clean.startsWith('62') ? '0' + clean.slice(2) : clean;

            // Delete from session_indosat.json
            const indosatPath = path.resolve(__dirname, 'session_indosat.json');
            if (fs.existsSync(indosatPath)) {
              try {
                const raw = JSON.parse(fs.readFileSync(indosatPath, 'utf-8'));
                if (raw.phoneNumber === msisdn62 || raw.phoneNumber === phone08) {
                  fs.unlinkSync(indosatPath);
                }
              } catch {}
            }

            // Delete from session_tri.json
            const triPath = path.resolve(__dirname, 'session_tri.json');
            if (fs.existsSync(triPath)) {
              try {
                const raw = JSON.parse(fs.readFileSync(triPath, 'utf-8'));
                let changed = false;
                if (raw[phone08]) {
                  delete raw[phone08];
                  changed = true;
                }
                if (raw[msisdn62]) {
                  delete raw[msisdn62];
                  changed = true;
                }
                if (changed) {
                  fs.writeFileSync(triPath, JSON.stringify(raw, null, 2), 'utf-8');
                }
              } catch {}
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                message: `Session for ${phoneParam} deleted from disk`,
              })
            );
            return;
          }

          const sessions: Record<string, any> = {};

          // Check Indosat
          const indosatPath = path.resolve(__dirname, 'session_indosat.json');
          if (fs.existsSync(indosatPath)) {
            const raw = JSON.parse(fs.readFileSync(indosatPath, 'utf-8'));
            if (raw.tokenId) {
              const phone = raw.phoneNumber
                ? raw.phoneNumber.startsWith('62')
                  ? '0' + raw.phoneNumber.slice(2)
                  : raw.phoneNumber
                : '085888399372';
              sessions[phone] = {
                operator: 'indosat',
                phoneNumber: phone,
                authorization: raw.authorization || '642d1cc69d90666962726e',
                tokenId: raw.tokenId,
                deviceId: raw.deviceId || '117178975203478994b3fb1a4b555cea',
                faiid: raw.faiid || 'dS576wMV4B4rhwhOuIKd0B',
                serviceKey: raw.serviceKey || 'i4WxFMMLvWqnrvuAyg58',
                isMock: false,
                updatedAt: raw.updatedAt || new Date().toISOString(),
              };
            }
          }

          // Check Tri
          const triPath = path.resolve(__dirname, 'session_tri.json');
          if (fs.existsSync(triPath)) {
            const raw = JSON.parse(fs.readFileSync(triPath, 'utf-8'));
            for (const [p, s] of Object.entries<any>(raw)) {
              if (s.tokenId) {
                const phone = p.startsWith('62') ? '0' + p.slice(2) : p;
                sessions[phone] = {
                  operator: 'tri',
                  phoneNumber: phone,
                  authorization: s.authorization || '642d1cc69d90666962726e',
                  tokenId: s.tokenId,
                  deviceId: s.deviceId || '117178975203478994b3fb1a4b555cea',
                  faiid: s.faiid || 'dS576wMV4B4rhwhOuIKd0B',
                  serviceKey: s.serviceKey || 'FPi7ZP3Jy8Uv3KBd4QeG',
                  isMock: false,
                  updatedAt: s.updatedAt || new Date().toISOString(),
                };
              }
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(sessions));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  plugins: [tailwindcss(), localSessionsPlugin()],
  build: {
    outDir: path.resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/bima-api': {
        target: 'https://bimaplus-api.ioh.co.id',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/bima-api/, ''),
        headers: {
          origin: 'https://bimatri.ioh.co.id',
          referer: 'https://bimatri.ioh.co.id/',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`\x1b[36m[BIMA REQ]\x1b[0m ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const color = (proxyRes.statusCode || 500) < 400 ? '\x1b[32m' : '\x1b[31m';
            console.log(`${color}[BIMA RES]\x1b[0m ${req.method} ${req.url} -> Status ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`\x1b[31m[BIMA ERR]\x1b[0m ${req.url}:`, err.message);
          });
        },
      },
      '/xl-api': {
        target: 'https://api.myxl.xlaxiata.co.id/api/v8',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/xl-api/, ''),
        headers: {
          origin: 'https://myxl.xlaxiata.co.id',
          referer: 'https://myxl.xlaxiata.co.id/',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`\x1b[34m[XL REQ]\x1b[0m ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const color = (proxyRes.statusCode || 500) < 400 ? '\x1b[32m' : '\x1b[31m';
            console.log(`${color}[XL RES]\x1b[0m ${req.method} ${req.url} -> Status ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`\x1b[31m[XL ERR]\x1b[0m ${req.url}:`, err.message);
          });
        },
      },
      '/indosat-api': {
        target: 'https://myim3api1.ioh.co.id',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/indosat-api/, ''),
        headers: {
          origin: 'https://myim3.ioh.co.id',
          referer: 'https://myim3.ioh.co.id/',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log(`\x1b[33m[INDOSAT REQ]\x1b[0m ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const color = (proxyRes.statusCode || 500) < 400 ? '\x1b[32m' : '\x1b[31m';
            console.log(`${color}[INDOSAT RES]\x1b[0m ${req.method} ${req.url} -> Status ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`\x1b[31m[INDOSAT ERR]\x1b[0m ${req.url}:`, err.message);
          });
        },
      },
      '/telkomsel-api': {
        target: 'https://www.telkomsel.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/telkomsel-api/, ''),
        headers: {
          origin: 'https://www.telkomsel.com',
          referer: 'https://www.telkomsel.com/',
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`\x1b[31m[TSEL REQ]\x1b[0m ${req.method} ${req.url}`);
            const sess = req.headers['x-session-login'];
            if (sess) {
              proxyReq.setHeader('cookie', `sessionLogin=${sess}`);
            }
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            const color = (proxyRes.statusCode || 500) < 400 ? '\x1b[32m' : '\x1b[31m';
            console.log(`${color}[TSEL RES]\x1b[0m ${req.method} ${req.url} -> Status ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req) => {
            console.error(`\x1b[31m[TSEL ERR]\x1b[0m ${req.url}:`, err.message);
          });
        },
      },
    },
  },
});

