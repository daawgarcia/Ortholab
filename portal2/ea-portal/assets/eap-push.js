/* Notificações no celular (Web Push) */
(function () {
  var C = window.EAP_PUSH; if (!C) return;
  var temSW = 'serviceWorker' in navigator, temPush = 'PushManager' in window && 'Notification' in window;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var FECHOU = 'eap-push-convite-fechado';

  function chave(b64) { var p = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function post(dados) { var f = new FormData(); f.append('action', 'eap_push_sub'); f.append('_n', C.n); for (var k in dados) { if (Array.isArray(dados[k])) dados[k].forEach(function (v) { f.append(k + '[]', v); }); else f.append(k, dados[k]); } return fetch(C.u, { method: 'POST', body: f, credentials: 'same-origin' }).then(function (r) { return r.json(); }); }
  function registro() { return navigator.serviceWorker.getRegistration('/').then(function (r) { return r || navigator.serviceWorker.register('/?eap_pwa=sw', { scope: '/' }); }).then(function () { return navigator.serviceWorker.ready; }); }
  function assinaturaAtual() { if (!temSW || !temPush) return Promise.resolve(null); return registro().then(function (r) { return r.pushManager.getSubscription(); }).catch(function () { return null; }); }

  function ativar() {
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'negado' : 'cancelado');
      return registro();
    }).then(function (r) {
      return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave(C.k) }); });
    }).then(function (s) { return post({ acao: 'ativar', sub: JSON.stringify(s) }); });
  }
  function desativar() {
    return assinaturaAtual().then(function (s) { if (!s) return; return post({ acao: 'sair', sub: JSON.stringify(s) }).then(function () { return s.unsubscribe(); }); });
  }

  // ---------- janela de preferências
  var m = document.createElement('div');
  m.className = 'eap-modal eap-push-modal'; m.hidden = true;
  m.innerHTML = '<div class="eap-modal__caixa"><button type="button" class="eap-modal__x" aria-label="Fechar">×</button><div class="eap-push-ic">🔔</div><strong class="eap-push-tit">Notificações no celular</strong><div class="eap-push-corpo"></div></div>';
  document.body.appendChild(m);
  var corpo = m.querySelector('.eap-push-corpo');
  function fechar() { m.hidden = true; }
  m.addEventListener('click', function (e) { if (e.target === m || e.target.classList.contains('eap-modal__x')) fechar(); });

  function cats() { return Object.keys(C.cats).map(function (k) { return '<label class="eap-push-cat"><input type="checkbox" value="' + k + '"' + (C.prefs.indexOf(k) >= 0 ? ' checked' : '') + '> ' + C.cats[k] + '</label>'; }).join(''); }
  function pintar() {
    if (ios && !instalado) {
      corpo.innerHTML = '<p>No iPhone, as notificações funcionam com o portal instalado na tela inicial (iOS 16.4 ou mais novo).</p><ol class="eap-push-passos"><li>Toque em <b>Compartilhar</b> no Safari.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Abra o portal pelo ícone e toque em <b>🔔 Notificações</b> para ativar.</li></ol><button type="button" class="eap-btn eap-btn--cheio" data-eap-app-link>Ver o passo a passo</button>';
      return;
    }
    if (!temSW || !temPush) { corpo.innerHTML = '<p>Este navegador não recebe notificações. No celular Android, use o Chrome; no computador, o Chrome ou o Edge.</p>'; return; }
    if (Notification.permission === 'denied') { corpo.innerHTML = '<p>As notificações do portal estão bloqueadas neste aparelho. Para liberar, toque no cadeado ao lado do endereço do site (ou nas configurações do navegador), em <b>Notificações → Permitir</b>, e volte aqui.</p>'; return; }
    corpo.innerHTML = '<p class="eap-push-st">Verificando…</p>';
    assinaturaAtual().then(function (s) {
      if (s) {
        corpo.innerHTML = '<p class="eap-push-st eap-push-st--ok">✓ Ativadas neste aparelho</p><p>O que você quer receber:</p><div class="eap-push-cats">' + cats() + '</div><p class="eap-push-obs">No máximo uma por dia, só das 8h às 20h.</p><button type="button" class="eap-push-sair">Desativar neste aparelho</button>';
        corpo.querySelectorAll('.eap-push-cat input').forEach(function (i) { i.addEventListener('change', function () { var sel = [].slice.call(corpo.querySelectorAll('.eap-push-cat input:checked')).map(function (x) { return x.value; }); C.prefs = sel; post({ acao: 'prefs', cats: sel.length ? sel : ['_nenhum'] }); }); });
        corpo.querySelector('.eap-push-sair').addEventListener('click', function () { desativar().then(pintar); });
      } else {
        corpo.innerHTML = '<p>Receba no celular os avisos de cursos, aulas novas e novidades da Esthetic Aligner. Você escolhe o que quer receber e pode desligar quando quiser.</p><button type="button" class="eap-btn eap-btn--cheio eap-push-ativar">Ativar notificações</button><p class="eap-push-obs">No máximo uma por dia, só das 8h às 20h.</p>';
        var b = corpo.querySelector('.eap-push-ativar');
        b.addEventListener('click', function () { b.disabled = true; b.textContent = 'Ativando…'; ativar().then(function (j) { if (j && j.data && j.data.prefs) C.prefs = j.data.prefs; localStorage.setItem(FECHOU, '1'); var cv = document.querySelector('.eap-push-convite'); if (cv) cv.parentNode.remove(); pintar(); }).catch(function (e) { if (e.message === 'negado') pintar(); else { b.disabled = false; b.textContent = 'Ativar notificações'; } }); });
      }
    });
  }
  window.eapPushAbrir = function () { m.hidden = false; pintar(); };
  document.addEventListener('click', function (e) { if (e.target.closest('[data-eap-push]')) { e.preventDefault(); window.eapPushAbrir(); } if (e.target.closest('.eap-push-modal [data-eap-app-link]')) fechar(); });

  // ---------- convite no início (só se ainda não ativou e não fechou)
  var lugar = document.querySelector('.eap-atalhos');
  if (lugar) {
    assinaturaAtual().then(function (s) {
      if (s || localStorage.getItem(FECHOU) || (temPush && Notification.permission === 'denied') || (!temPush && !ios)) return;
      var d = document.createElement('section');
      d.className = 'eap-wrap';
      d.innerHTML = '<div class="eap-push-convite"><div><span class="eap-push-convite__ic">🔔</span><span><strong>Receba avisos no celular</strong><em>Cursos, aulas novas e novidades da Esthetic Aligner, sem precisar entrar no portal.</em></span></div><div><button type="button" class="eap-btn eap-btn--cheio" data-eap-push>Ativar</button><button type="button" class="eap-push-convite__x" aria-label="Agora não">Agora não</button></div></div>';
      lugar.parentNode.insertBefore(d, lugar);
      d.querySelector('.eap-push-convite__x').addEventListener('click', function () { localStorage.setItem(FECHOU, '1'); d.remove(); });
    });
  }
})();
