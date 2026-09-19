const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const BASE = 'https://ortholab.estheticaligner.com.br';
const EMAIL = 'marketing@estheticaligner.com.br';
const PASSWORD = 'Otavio2805@';
const BATCH_MS = 5 * 60 * 1000;
const OUT_DIR = path.join(__dirname, '..', 'tmp-migration');

fs.mkdirSync(OUT_DIR, { recursive: true });

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(parsed, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (options.data) req.write(options.data);
    req.end();
  });
}

function parseCookies(headers) {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list
    .map((h) => String(h).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function login() {
  const loginPage = await request(`${BASE}/pt-BR/users/sign_in`);
  const csrfMatch = loginPage.body.match(/name="authenticity_token"\s+value="([^"]+)"/i);
  if (!csrfMatch) {
    throw new Error('CSRF do login do old não encontrado');
  }

  const form = new URLSearchParams({
    authenticity_token: csrfMatch[1],
    'user[email]': EMAIL,
    'user[password]': PASSWORD,
    commit: 'Entrar',
  }).toString();

  const post = await request(`${BASE}/pt-BR/users/sign_in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${BASE}/pt-BR/users/sign_in`,
      Origin: BASE,
      Cookie: parseCookies(loginPage.headers['set-cookie']),
      'User-Agent': 'Mozilla/5.0',
    },
    data: form,
  });

  const cookieParts = [
    parseCookies(loginPage.headers['set-cookie']),
    parseCookies(post.headers['set-cookie']),
  ].flatMap((value) => value ? value.split('; ').filter(Boolean) : []);

  const cookieMap = new Map();
  for (const part of cookieParts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) cookieMap.set(part.slice(0, eqIdx), part);
  }

  const cookie = Array.from(cookieMap.values()).join('; ');
  if (!cookie.includes('_easysmile-web_session')) {
    throw new Error('Sessão _easysmile-web_session não foi obtida do old');
  }

  return cookie;
}

async function runBatch() {
  const cookie = await login();
  const endpoints = [
    '/workflow_control/planning_center/list.json',
    '/workflow_control/print/list.json',
    '/workflow_control/laboratory/list.json',
    '/workflow_control/expedition/list.json',
    '/workflow_control/financial/list.json',
  ];

  const summary = {};
  for (const endpoint of endpoints) {
    const res = await request(`${BASE}${endpoint}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    });

    const parsed = safeJsonParse(res.body);
    const count = Array.isArray(parsed) ? parsed.length : parsed && typeof parsed === 'object' ? 1 : 0;
    summary[endpoint] = { status: res.status, count };

    if (Array.isArray(parsed) && parsed.length > 0) {
      const safeName = endpoint.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'batch';
      const file = path.join(OUT_DIR, `${Date.now()}-${safeName}.json`);
      fs.writeFileSync(file, JSON.stringify(parsed.slice(0, 200), null, 2));
      console.log(`[batch] ${endpoint}: ${count} registros salvados em ${path.basename(file)}`);
    } else {
      console.log(`[batch] ${endpoint}: status=${res.status}, count=${count}`);
    }
  }

  const manifest = path.join(OUT_DIR, `manifest-${Date.now()}.json`);
  fs.writeFileSync(manifest, JSON.stringify({ capturedAt: new Date().toISOString(), summary }, null, 2));
  console.log(`[batch] manifest: ${path.basename(manifest)}`);
  return summary;
}

(async () => {
  console.log('[background-sync] iniciando worker one-way old -> new');
  await runBatch();
  setInterval(async () => {
    try {
      await runBatch();
    } catch (error) {
      console.error('[background-sync] erro no ciclo:', error.message || error);
    }
  }, BATCH_MS);
})();
