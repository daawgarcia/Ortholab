const https = require('https');
const { URL } = require('url');

const BASE = 'https://ortholab.estheticaligner.com.br';
const EMAIL = 'marketing@estheticaligner.com.br';
const PASSWORD = 'Otavio2805@';

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
  const arr = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return arr.map((h) => String(h).split(';')[0].trim()).filter(Boolean).join('; ');
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function countFromNode(node) {
  if (Array.isArray(node)) return node.length;
  if (node && typeof node === 'object') {
    const keys = Object.keys(node);
    if (Array.isArray(node.items)) return node.items.length;
    if (Array.isArray(node.data)) return node.data.length;
    if (Array.isArray(node.results)) return node.results.length;
    if (Array.isArray(node.users)) return node.users.length;
    if (Array.isArray(node.patients)) return node.patients.length;
    if (Array.isArray(node.dentists)) return node.dentists.length;
    if (node.total !== undefined && typeof node.total === 'number') return node.total;
    return keys.length;
  }
  return 0;
}

async function main() {
  const loginPage = await request(`${BASE}/pt-BR/users/sign_in`);
  const csrf = (loginPage.body.match(/name="authenticity_token"\s+value="([^"]+)"/i) || [])[1];
  if (!csrf) throw new Error('CSRF not found');

  const formData = new URLSearchParams({
    authenticity_token: csrf,
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
    data: formData,
  });

  const cookieMap = new Map();
  for (const part of [
    ...parseCookies(loginPage.headers['set-cookie']).split('; ').filter(Boolean),
    ...parseCookies(post.headers['set-cookie']).split('; ').filter(Boolean),
  ]) {
    const idx = part.indexOf('=');
    if (idx > 0) cookieMap.set(part.slice(0, idx), part);
  }
  const cookie = Array.from(cookieMap.values()).join('; ');

  const endpoints = [
    '/workflow_control/dentists/list.json',
    '/workflow_control/patients/list.json',
    '/workflow_control/planning_center/list.json',
    '/workflow_control/laboratory/list.json',
    '/workflow_control/expedition/list.json',
    '/workflow_control/print/list.json',
    '/dentists.json',
    '/patients.json',
    '/users.json',
    '/pt-BR/dentists.json',
    '/pt-BR/patients.json',
    '/pt-BR/users.json',
    '/api/v1/dentists',
    '/api/v1/patients',
    '/api/v1/users',
  ];

  const found = [];
  for (const endpoint of endpoints) {
    const res = await request(`${BASE}${endpoint}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    });

    const parsed = safeJson(res.body);
    const count = countFromNode(parsed);
    if (res.status === 200 && (count > 0 || (parsed && typeof parsed === 'object'))) {
      found.push({ endpoint, status: res.status, count, sample: Array.isArray(parsed) ? parsed.slice(0, 2) : (parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 4) : []) });
    }
  }

  console.log(JSON.stringify({ source: BASE, found }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
