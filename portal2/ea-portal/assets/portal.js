/* EA Portal do Credenciado */
(function () {
  // menu no celular
  var bt = document.querySelector('[data-eap-menu]');
  var nav = document.querySelector('[data-eap-nav]');
  if (bt && nav) bt.addEventListener('click', function () { nav.classList.toggle('is-aberto'); });

  // mostrar/ocultar senha
  document.querySelectorAll('[data-eap-ver]').forEach(function (b) {
    b.addEventListener('click', function () {
      var i = b.parentNode.querySelector('input');
      var ver = i.type === 'password';
      i.type = ver ? 'text' : 'password';
      b.textContent = ver ? 'ocultar' : 'ver';
    });
  });

  // aulas assistidas (fica salvo neste navegador)
  var CH = 'eap-aulas-feitas';
  function lerFeitas() { try { return JSON.parse(localStorage.getItem(CH) || '[]'); } catch (e) { return []; } }
  function gravarFeitas(l, sinc) {
    try { localStorage.setItem(CH, JSON.stringify(l)); } catch (e) { /* sem armazenamento */ }
    var S = window.EAP_FEITAS;
    if (S && sinc !== false) { var f = new FormData(); f.append('action', 'eap_feitas'); f.append('_n', S.n); f.append('ids', l.join(',')); fetch(S.u, { method: 'POST', body: f, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.data && j.data.curso) { document.querySelectorAll('[data-eap-cert-faixa]').forEach(function (x) { x.hidden = false; }); if (j.data.novo && window.eapCertAbrir) window.eapCertAbrir(true); }
    }).catch(function () {}); }
  }
  (function () {
    var S = window.EAP_FEITAS; if (!S) return;
    if (S.ids.length) gravarFeitas(S.ids, false);
    else if (lerFeitas().length) gravarFeitas(lerFeitas());
  })();
  function pintar() {
    var f = lerFeitas();
    document.querySelectorAll('[data-eap-item]').forEach(function (li) {
      li.classList.toggle('is-feito', f.indexOf(li.getAttribute('data-eap-item')) >= 0);
    });
    document.querySelectorAll('[data-eap-prog]').forEach(function (s) {
      var ids = s.getAttribute('data-eap-prog').split(',');
      var n = ids.filter(function (id) { return f.indexOf(id) >= 0; }).length;
      s.textContent = n ? n + ' de ' + ids.length + ' assistidas' : ids.length + ' aulas';
    });
  }
  document.querySelectorAll('[data-eap-feito]').forEach(function (c) {
    var id = c.getAttribute('data-eap-feito');
    c.checked = lerFeitas().indexOf(id) >= 0;
    c.addEventListener('change', function () {
      var f = lerFeitas().filter(function (x) { return x !== id; });
      if (c.checked) f.push(id);
      gravarFeitas(f);
      pintar();
    });
  });
  pintar();

  // rola a lista até a aula atual
  var atual = document.querySelector('.eap-curso__lista .is-atual');
  var lista = document.querySelector('.eap-curso__lista');
  if (atual && lista && lista.scrollHeight > lista.clientHeight) lista.scrollTop = atual.offsetTop - 120;

  // busca de aulas
  var busca = document.querySelector('[data-eap-busca]');
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  if (busca) busca.addEventListener('input', function () {
    var q = norm(busca.value.trim());
    document.querySelectorAll('.eap-trilha').forEach(function (t) {
      var algum = false;
      t.querySelectorAll('li').forEach(function (li) {
        var ok = !q || norm(li.textContent).indexOf(q) >= 0;
        li.style.display = ok ? '' : 'none';
        if (ok) algum = true;
      });
      t.style.display = algum ? '' : 'none';
      if (q && algum) t.open = true;
    });
  });

  // busca e temas dos materiais
  var bm = document.querySelector('[data-eap-busca-mat]'), temaAtivo = '';
  function filtrarMat() {
    var q = bm ? norm(bm.value.trim()) : '';
    document.querySelectorAll('[data-eap-grupo]').forEach(function (g) {
      var noTema = !temaAtivo || g.getAttribute('data-eap-grupo') === temaAtivo, vis = 0;
      g.querySelectorAll('[data-eap-mat]').forEach(function (a) {
        var ok = noTema && (!q || norm(a.textContent).indexOf(q) >= 0);
        a.style.display = ok ? '' : 'none'; if (ok) vis++;
      });
      g.style.display = vis ? '' : 'none';
    });
  }
  if (bm) bm.addEventListener('input', filtrarMat);
  document.querySelectorAll('[data-eap-chips-mat] button').forEach(function (b) {
    b.addEventListener('click', function () {
      temaAtivo = b.getAttribute('data-tema');
      document.querySelectorAll('[data-eap-chips-mat] button').forEach(function (x) { x.classList.toggle('is-ativo', x === b); });
      filtrarMat();
    });
  });
  // posts: teclado
  document.querySelectorAll('[data-eap-post]').forEach(function (c) {
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } });
  });
})();

(function () {
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  // FAQ
  var bf = document.querySelector('[data-eap-busca-faq]');
  if (bf) bf.addEventListener('input', function () {
    var q = norm(bf.value.trim());
    document.querySelectorAll('[data-eap-faq]').forEach(function (d) {
      var ok = !q || norm(d.textContent).indexOf(q) >= 0;
      d.style.display = ok ? '' : 'none';
    });
  });
  // Clube: busca + categorias
  var bc = document.querySelector('[data-eap-busca-clube]');
  var cat = '';
  function filtraClube() {
    var q = bc ? norm(bc.value.trim()) : '';
    document.querySelectorAll('[data-eap-parc]').forEach(function (a) {
      var okq = !q || norm(a.textContent).indexOf(q) >= 0;
      var okc = !cat || (' ' + a.getAttribute('data-cats') + ' ').indexOf(' ' + cat + ' ') >= 0;
      a.style.display = okq && okc ? '' : 'none';
    });
  }
  if (bc) bc.addEventListener('input', filtraClube);
  document.querySelectorAll('[data-eap-filtros] button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-eap-filtros] button').forEach(function (x) { x.classList.remove('is-ativo'); });
      b.classList.add('is-ativo'); cat = b.getAttribute('data-cat'); filtraClube();
    });
  });
  // copiar cupom
  function copiar(txt, el, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
      var o = el.innerHTML; el.innerHTML = msg; setTimeout(function () { el.innerHTML = o; }, 1600);
    }).catch(function () { window.prompt('Copie:', txt); });
  }
  document.querySelectorAll('[data-eap-copiar]').forEach(function (b) {
    b.addEventListener('click', function () { copiar(b.getAttribute('data-eap-copiar'), b, 'Cupom copiado ✓'); });
  });
  // posts: modal
  var modal = document.querySelector('[data-eap-modal]');
  if (modal) {
    var img = modal.querySelector('[data-eap-modal-img]'), tit = modal.querySelector('[data-eap-modal-tit]'),
      leg = modal.querySelector('[data-eap-modal-leg]'), baixar = modal.querySelector('[data-eap-baixar]'),
      bleg = modal.querySelector('[data-eap-copiar-leg]');
    document.querySelectorAll('[data-eap-post]').forEach(function (c) {
      c.addEventListener('click', function () {
        img.src = c.getAttribute('data-img'); tit.textContent = c.getAttribute('data-titulo');
        var l = c.getAttribute('data-legenda') || '';
        leg.textContent = l || 'Sem legenda sugerida. Use a arte com o texto que preferir.';
        bleg.style.display = l ? '' : 'none'; bleg.onclick = function () { copiar(l, bleg, 'Legenda copiada ✓'); };
        baixar.href = c.getAttribute('data-img');
        modal.hidden = false; document.body.style.overflow = 'hidden';
      });
    });
    function fechar() { modal.hidden = true; document.body.style.overflow = ''; }
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.hasAttribute('data-eap-fechar')) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });
  }
})();
