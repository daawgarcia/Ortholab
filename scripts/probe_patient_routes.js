const https = require('https');
const BASE = 'https://ortholab.estheticaligner.com.br';
const Email = 'marketing@estheticaligner.com.br';
const Password = 'Otavio2805@';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (options.data) req.write(options.data);
    req.end();
  });
}

function parseCookies(headers) {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list.map((h) => String(h).split(';')[0].trim()).filter(Boolean).join('; ');
}

async function login() {
  const page = await request(`${BASE}/pt-BR/users/sign_in`);
  const csrf = (page.body.match(/name="authenticity_token"\s+value="([^"]+)"/i) || [])[1];
  const form = new URLSearchParams({
    authenticity_token: csrf || '',
    'user[email]': Email,
    'user[password]': Password,
    commit: 'Entrar',
  }).toString();

  const post = await request(`${BASE}/pt-BR/users/sign_in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${BASE}/pt-BR/users/sign_in`,
      Origin: BASE,
      Cookie: parseCookies(page.headers['set-cookie']),
      'User-Agent': 'Mozilla/5.0',
    },
    data: form,
  });

  const cookieMap = new Map();
  for (const part of [
    ...parseCookies(page.headers['set-cookie']).split('; ').filter(Boolean),
    ...parseCookies(post.headers['set-cookie']).split('; ').filter(Boolean),
  ]) {
    const idx = part.indexOf('=');
    if (idx > 0) cookieMap.set(part.slice(0, idx), part);
  }

  const cookie = Array.from(cookieMap.values()).join('; ');
  if (!cookie.includes('_easysmile-web_session')) throw new Error('No session cookie');
  return cookie;
}

(async () => {
  const cookie = await login();
  const ids = [28193, 25614, 31805, 31861, 11804, 27461];
  const paths = [
    '/pt-BR/patients/{id}', '/patients/{id}',
    '/pt-BR/patients/{id}/files', '/patients/{id}/files',
    '/pt-BR/patients/{id}/attachments', '/patients/{id}/attachments',
    '/pt-BR/patients/{id}/works', '/patients/{id}/works',
    '/pt-BR/patients/{id}/v2/works', '/patients/{id}/v2/works',
    '/pt-BR/patients/{id}/v2/works.json', '/patients/{id}/v2/works.json',
    '/pt-BR/patients/{id}/reports', '/patients/{id}/reports',
    '/pt-BR/patients/{id}/documents', '/patients/{id}/documents',
    '/pt-BR/patients/{id}.json', '/patients/{id}.json'
  ];

  for (const id of ids) {
    console.log(`\n=== patient ${id} ===`);
    for (const pattern of paths) {
      const path = pattern.replace('{id}', String(id));
      const res = await request(`${BASE}${path}`, {
        headers: {
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0',
          Accept: '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        }
      });
      if (res.status < 400 || res.status === 404 || res.status === 500) {
        console.log('PATH', path, 'STATUS', res.status, 'TYPE', res.headers['content-type'] || '');
        console.log(res.body.replace(/\s+/g, ' ').slice(0, 300));
      }
    }
  }
})();
