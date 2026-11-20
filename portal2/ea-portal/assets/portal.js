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
  function gravarFeitas(l) { try { localStorage.setItem(CH, JSON.stringify(l)); } catch (e) { /* sem armazenamento */ } }
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

  // busca de materiais
  var bm = document.querySelector('[data-eap-busca-mat]');
  if (bm) bm.addEventListener('input', function () {
    var q = norm(bm.value.trim());
    document.querySelectorAll('[data-eap-mat]').forEach(function (a) {
      a.style.display = !q || norm(a.textContent).indexOf(q) >= 0 ? '' : 'none';
    });
  });
})();
