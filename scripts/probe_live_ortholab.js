const https = require('https');
const { URL } = require('url');

const BASE = 'https://ortholab.estheticaligner.com.br';
const Email = 'marketing@estheticaligner.com.br';
const Password = 'Otavio2805@';

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
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (options.data) req.write(options.data);
    req.end();
  });
}

async function main() {
  const loginPage = await request(`${BASE}/pt-BR/users/sign_in`);
  console.log('GET_LOGIN_STATUS', loginPage.status);
  const csrf = (loginPage.body.match(/name="authenticity_token"\s+value="([^"]+)"/) || [])[1];
  console.log('CSRF_FOUND', !!csrf, csrf ? csrf.slice(0, 20) : null);

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
      Cookie: (loginPage.headers['set-cookie'] || []).join('; '),
      'User-Agent': 'Mozilla/5.0',
    },
    data: form,
  });

  console.log('POST_STATUS', post.status);
  console.log('POST_LOCATION', post.headers.location || null);
  console.log('SET_COOKIE', post.headers['set-cookie'] || []);

  const cookieHeader = [...(loginPage.headers['set-cookie'] || []), ...(post.headers['set-cookie'] || [])].join('; ');
  const paths = [
    '/workflow_control/planning_center/list.json',
    '/workflow_control/print/list.json',
    '/workflow_control/laboratory/list.json',
    '/workflow_control/expedition/list.json',
    '/workflow_control/dentists/list.json',
    '/users.json',
    '/patients.json',
    '/dentists.json',
  ];

  for (const path of paths) {
    const resp = await request(`${BASE}${path}`, {
      headers: {
        Cookie: cookieHeader,
        'User-Agent': 'Mozilla/5.0',
      },
    });
    console.log('\nPATH', path, 'STATUS', resp.status, 'CT', resp.headers['content-type']);
    const preview = resp.body.replace(/\s+/g, ' ').slice(0, 800);
    console.log(preview);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
