/* EA Portal – "Minha marca" nos posts e orçamento para o paciente. Depende de eap-ferramentas.js (EAPF). */
(function () {
  var C = window.EAP_FERR; if (!C || !window.EAPF) return;
  var FONTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var CORES = { claro: { fundo: '#ffffff', txt: '#1b2433', sub: '#5b6576', linha: '#2f6fe4' }, escuro: { fundo: '#0d1f42', txt: '#ffffff', sub: 'rgba(255,255,255,.75)', linha: '#3fa2f2' }, azul: { fundo: '#2f6fe4', txt: '#ffffff', sub: 'rgba(255,255,255,.85)', linha: '#ffffff' } };

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function post(acao, dados) {
    var f = new FormData(); f.append('action', acao); f.append('_n', C.n);
    Object.keys(dados).forEach(function (k) { f.append(k, dados[k] == null ? '' : dados[k]); });
    return fetch(C.u, { method: 'POST', body: f, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }
  function fone(v) {
    var d = String(v || '').replace(/\D/g, ''); if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return v || '';
  }
  function abrirModal(m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
  function fecharModal(m) { m.hidden = true; document.body.style.overflow = ''; }
  function modal(html) {
    var m = el('<div class="eap-modal eap-ferr-modal" hidden><div class="eap-modal__caixa"><button type="button" class="eap-modal__x" aria-label="Fechar">×</button>' + html + '</div></div>');
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.classList.contains('eap-modal__x')) fecharModal(m); });
    return m;
  }

  /* ---------------------------------------------------------------- faixa com a marca */
  function desenharFaixa(x, marca, X, Y, W, H, logoImg) {
    var c = CORES[marca.cor] || CORES.claro, pad = W * 0.05;
    x.fillStyle = c.fundo; x.fillRect(X, Y, W, H);
    x.fillStyle = c.linha; x.fillRect(X, Y, W, Math.max(4, H * 0.025));
    var tx = X + pad;
    if (logoImg) {
      var bh = H * 0.62, bw = W * 0.32, r = Math.min(bw / logoImg.width, bh / logoImg.height), lw = logoImg.width * r, lh = logoImg.height * r;
      x.drawImage(logoImg, X + pad, Y + (H - lh) / 2 + H * 0.01, lw, lh);
      tx = X + pad + lw + pad * 0.8;
      x.fillStyle = c.sub; x.globalAlpha = .35; x.fillRect(tx - pad * 0.4, Y + H * 0.22, Math.max(2, W * 0.002), H * 0.58); x.globalAlpha = 1;
    }
    var larg = X + W - pad - tx, linhas = [];
    if (marca.whats) linhas.push('WhatsApp ' + fone(marca.whats));
    if (marca.insta) linhas.push('@' + marca.insta.replace(/^@/, ''));
    if (marca.site) linhas.push(marca.site);
    var tNome = H * 0.2, tLin = H * 0.12, total = tNome + linhas.length * tLin * 1.35 + tLin * 1.2, y = Y + (H - total) / 2 + tNome * 0.85;
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = c.txt;
    var t = tNome; do { x.font = '700 ' + t + 'px ' + FONTE; t -= 2; } while (x.measureText(marca.nome || '').width > larg && t > 12);
    x.fillText(marca.nome || '', tx, y);
    y += tLin * 1.45; x.fillStyle = c.sub;
    linhas.forEach(function (l) { var tt = tLin; do { x.font = '500 ' + tt + 'px ' + FONTE; tt -= 1; } while (x.measureText(l).width > larg && tt > 10); x.fillText(l, tx, y); y += tLin * 1.35; });
    x.font = '600 ' + (tLin * 0.78) + 'px ' + FONTE; x.globalAlpha = .8; x.fillText('Credenciado Esthetic Aligner', tx, y + tLin * 0.1); x.globalAlpha = 1;
  }
  function logoDe(marca) { return marca && marca.logo ? EAPF.img(marca.logo).catch(function () { return null; }) : Promise.resolve(null); }
  /* post quadrado + faixa embaixo = formato 4:5 (o retrato do feed do Instagram) */
  function comporPost(src, marca) {
    return Promise.all([EAPF.img(src), logoDe(marca)]).then(function (r) {
      var im = r[0], W = Math.min(im.width, 1440), H = Math.round(im.height * W / im.width), F = Math.round(W * 1.25) - H;
      var c = document.createElement('canvas'); c.width = W; c.height = H + F;
      var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); desenharFaixa(x, marca, 0, H, W, F, r[1]);
      return c;
    });
  }

  /* ---------------------------------------------------------------- modal "Minha marca" */
  var mm = null, depois = null;
  function modalMarca(cb) {
    depois = cb || null;
    if (!mm) {
      mm = modal('<h3 class="eap-ferr-tit">Minha marca</h3><p class="eap-ferr-sub">Seus dados aparecem numa faixa embaixo dos posts (e no topo do orçamento para o paciente). Você preenche uma vez só.</p>'
        + '<div class="eap-ferr-grid"><div class="eap-ferr-campos">'
        + '<label>Nome do consultório ou profissional<input data-k="nome" maxlength="80" placeholder="Ex.: Clínica Sorriso – Dra. Ana Lima"></label>'
        + '<label>WhatsApp<input data-k="whats" maxlength="30" inputmode="tel" placeholder="(11) 99999-9999"></label>'
        + '<label>Instagram<input data-k="insta" maxlength="40" placeholder="@seuconsultorio"></label>'
        + '<label>Site (opcional)<input data-k="site" maxlength="60" placeholder="www.seuconsultorio.com.br"></label>'
        + '<label>Logo (PNG ou JPG)<input type="file" accept="image/png,image/jpeg" data-logo-arq><span class="eap-ferr-logo"><img data-logo-prev alt="" hidden><button type="button" class="eap-ferr-link" data-logo-tirar hidden>remover logo</button></span></label>'
        + '<div class="eap-ferr-cores"><span>Cor da faixa</span><button type="button" data-cor="claro">Clara</button><button type="button" data-cor="escuro">Escura</button><button type="button" data-cor="azul">Azul</button></div>'
        + '</div><div class="eap-ferr-prev"><canvas data-prev></canvas><small>Prévia</small></div></div>'
        + '<p class="eap-ferr-erro" data-erro hidden></p><button type="button" class="eap-btn eap-btn--cheio eap-ferr-bt" data-salvar>Salvar minha marca</button>');
      var ent = mm.querySelectorAll('[data-k]'), arq = mm.querySelector('[data-logo-arq]'), lp = mm.querySelector('[data-logo-prev]'), lt = mm.querySelector('[data-logo-tirar]'), est = {};
      function ler() { var m = { cor: est.cor || 'claro', logo: est.logo || '' }; ent.forEach(function (i) { m[i.getAttribute('data-k')] = i.value.trim(); }); return m; }
      var tPrev = 0;
      function prev() {
        clearTimeout(tPrev); tPrev = setTimeout(function () {
          var src = (document.querySelector('[data-eap-post]') || {}).getAttribute ? document.querySelector('[data-eap-post]').getAttribute('data-img') : null;
          var cv = mm.querySelector('[data-prev]'), m = ler(); if (!m.nome) m.nome = 'Nome do seu consultório';
          var desenha = function (c) { cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0); };
          if (src) comporPost(src, m).then(desenha).catch(function () {});
          else logoDe(m).then(function (l) { var c = document.createElement('canvas'); c.width = 800; c.height = 200; desenharFaixa(c.getContext('2d'), m, 0, 0, 800, 200, l); desenha(c); });
        }, 150);
      }
      mm._carregar = function () {
        var m = C.marca || {}; ent.forEach(function (i) { var k = i.getAttribute('data-k'); i.value = k === 'whats' ? (m.whats || C.dentista.whats || '') : k === 'nome' ? (m.nome || C.dentista.nome || '') : (m[k] || ''); });
        est.cor = m.cor || 'claro'; est.logo = m.logo || '';
        lp.src = est.logo; lp.hidden = lt.hidden = !est.logo;
        mm.querySelectorAll('[data-cor]').forEach(function (b) { b.classList.toggle('is-ativo', b.getAttribute('data-cor') === est.cor); });
        prev();
      };
      ent.forEach(function (i) { i.addEventListener('input', prev); });
      mm.querySelectorAll('[data-cor]').forEach(function (b) { b.addEventListener('click', function () { est.cor = b.getAttribute('data-cor'); mm.querySelectorAll('[data-cor]').forEach(function (o) { o.classList.toggle('is-ativo', o === b); }); prev(); }); });
      arq.addEventListener('change', function () {
        var f = arq.files[0]; if (!f) return;
        var rd = new FileReader(); rd.onload = function () {
          EAPF.img(rd.result).then(function (im) {
            var r = Math.min(1, 600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
            c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
            est.logo = c.toDataURL('image/png'); if (est.logo.length > 590000) est.logo = c.toDataURL('image/jpeg', 0.9);
            lp.src = est.logo; lp.hidden = lt.hidden = false; prev();
          });
        }; rd.readAsDataURL(f);
      });
      lt.addEventListener('click', function () { est.logo = ''; arq.value = ''; lp.hidden = lt.hidden = true; prev(); });
      mm.querySelector('[data-salvar]').addEventListener('click', function () {
        var m = ler(), er = mm.querySelector('[data-erro]'), bt = this;
        if (!m.nome) { er.textContent = 'Preencha o nome do consultório ou profissional.'; er.hidden = false; return; }
        er.hidden = true; bt.disabled = true; bt.textContent = 'Salvando…';
        post('eap_marca', m).then(function (j) {
          bt.disabled = false; bt.textContent = 'Salvar minha marca';
          if (!j.success) { er.textContent = j.data === 'logo' ? 'Não consegui usar esse logo. Tente um PNG ou JPG menor.' : 'Não foi possível salvar. Tente de novo.'; er.hidden = false; return; }
          C.marca = j.data; pintarBarra(); fecharModal(mm); if (depois) { var d = depois; depois = null; d(); }
        }).catch(function () { bt.disabled = false; bt.textContent = 'Salvar minha marca'; er.textContent = 'Sem conexão. Tente de novo.'; er.hidden = false; });
      });
    }
    mm._carregar(); abrirModal(mm);
  }
  window.eapMarcaAbrir = modalMarca;

  /* barra "Minha marca" na página Marketing */
  function pintarBarra() {
    document.querySelectorAll('[data-eap-marca-barra]').forEach(function (b) {
      var m = C.marca;
      b.innerHTML = m && m.nome
        ? '<span class="eap-marca-barra__ok">' + (m.logo ? '<img src="' + esc(m.logo) + '" alt="">' : '') + '<span><b>Sua marca nos posts:</b> ' + esc(m.nome) + (m.whats ? ' · ' + esc(fone(m.whats)) : '') + '</span></span><button type="button" class="eap-btn eap-btn--linha" data-eap-marca-editar>Editar minha marca</button>'
        : '<span><b>Novo:</b> coloque o logo e o WhatsApp do seu consultório nos posts, prontos para postar.</span><button type="button" class="eap-btn eap-btn--cheio" data-eap-marca-editar>Colocar minha marca</button>';
      b.hidden = false;
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-eap-marca-editar]')) modalMarca(); });
  pintarBarra();

  /* botão "Baixar com a minha marca" na janela do post */
  var pm = document.querySelector('[data-eap-modal]');
  if (pm) {
    var acoes = pm.querySelector('.eap-modal__acoes'), orig = pm.querySelector('[data-eap-baixar]');
    var bm = el('<button type="button" class="eap-btn eap-btn--cheio eap-btn--marca">Baixar com a minha marca</button>');
    acoes.appendChild(bm);
    orig.classList.remove('eap-btn--cheio'); orig.classList.add('eap-btn--linha'); orig.textContent = 'Baixar sem marca';
    var nota = el('<small class="eap-modal__nota">Com a sua marca, o post sai no formato 4:5 (retrato do feed do Instagram).</small>'); acoes.parentNode.appendChild(nota);
    function baixarMarca() {
      var src = orig.getAttribute('href'), tit = (pm.querySelector('[data-eap-modal-tit]') || {}).textContent || 'post';
      bm.disabled = true; bm.textContent = 'Preparando…';
      comporPost(src, C.marca).then(function (c) {
        c.toBlob(function (b) { EAPF.baixar(b, tit.replace(/[^\wÀ-ú -]+/g, '').trim().slice(0, 60) + ' - minha marca.jpg'); bm.disabled = false; bm.textContent = 'Baixar com a minha marca'; }, 'image/jpeg', 0.92);
        if (window.eapEvento) window.eapEvento('post_baixar', 0, 'marca');
      }).catch(function () { bm.disabled = false; bm.textContent = 'Baixar com a minha marca'; alert('Não foi possível montar a imagem. Tente de novo.'); });
    }
    bm.addEventListener('click', function () { if (C.marca && C.marca.nome) baixarMarca(); else modalMarca(baixarMarca); });
  }

  /* ---------------------------------------------------------------- orçamento para o paciente */
  var PAC = { unidade: { nome: 'Compra por Unidade', prazo: '6 a 8 meses' }, mid: { nome: 'Pacote MID', prazo: 'cerca de 10 meses' }, full: { nome: 'Pacote FULL', prazo: 'acima de 10 meses' } };
  function pacoteDe(txt) { txt = (txt || '').toLowerCase(); return txt.indexOf('full') >= 0 ? 'full' : txt.indexOf('mid') >= 0 ? 'mid' : txt.indexOf('unidade') >= 0 ? 'unidade' : ''; }
  function num(v) { v = String(v || '').replace(/[^\d,.-]/g, ''); if (v.indexOf(',') >= 0) v = v.replace(/\./g, '').replace(',', '.'); var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function brl(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  var mo = null;
  function modalOrc(pre) {
    pre = pre || {};
    if (!mo) {
      mo = modal('<h3 class="eap-ferr-tit">Orçamento para o paciente</h3><p class="eap-ferr-sub">Os valores são <b>seus</b>: você define quanto cobra. Eles ficam salvos só na sua conta para os próximos orçamentos.</p>'
        + '<div class="eap-ferr-campos eap-ferr-campos--2">'
        + '<label class="l2">Nome do paciente<input data-o="paciente" maxlength="80"></label>'
        + '<label>Tratamento<select data-o="pacote"><option value="unidade">Compra por Unidade (6 a 8 meses)</option><option value="mid">Pacote MID (cerca de 10 meses)</option><option value="full">Pacote FULL (acima de 10 meses)</option></select></label>'
        + '<label>Valor total do tratamento (R$)<input data-o="valor" inputmode="decimal" placeholder="Ex.: 8.500,00"></label>'
        + '<label>Entrada (R$, opcional)<input data-o="entrada" inputmode="decimal" placeholder="0,00"></label>'
        + '<label>Parcelas do restante<input data-o="parcelas" inputmode="numeric" maxlength="2"></label>'
        + '<label class="l2">Formas de pagamento<input data-o="pagamento" maxlength="60"></label>'
        + '<label>Validade da proposta (dias)<input data-o="validade" inputmode="numeric" maxlength="3"></label>'
        + '<label class="l2">Observações (opcional)<textarea data-o="obs" maxlength="400" rows="2" placeholder="Ex.: inclui contenção ao final do tratamento."></textarea></label>'
        + '</div><div class="eap-ferr-resumo" data-resumo></div>'
        + '<label class="eap-ferr-check"><input type="checkbox" data-o-salvar checked> Salvar estes valores como meu padrão</label>'
        + '<p class="eap-ferr-marca" data-o-marca></p>'
        + '<p class="eap-ferr-erro" data-erro hidden></p><button type="button" class="eap-btn eap-btn--cheio eap-ferr-bt" data-gerar>Gerar orçamento (PDF)</button>');
      var g = function (k) { return mo.querySelector('[data-o="' + k + '"]'); };
      mo._g = g;
      function resumo() {
        var v = num(g('valor').value), e = num(g('entrada').value), p = Math.max(1, parseInt(g('parcelas').value, 10) || 1), r = mo.querySelector('[data-resumo]');
        r.innerHTML = v ? 'Total <b>' + brl(v) + '</b>' + (e ? ' · entrada ' + brl(e) : '') + ' · ' + (v - e > 0 ? p + 'x de <b>' + brl((v - e) / p) + '</b>' : 'à vista') : 'Preencha o valor para ver o resumo.';
      }
      mo.querySelectorAll('[data-o]').forEach(function (i) { i.addEventListener('input', resumo); });
      g('pacote').addEventListener('change', function () { g('valor').value = C.valores[g('pacote').value] || ''; resumo(); });
      mo._resumo = resumo;
      mo.addEventListener('click', function (e) { if (e.target.closest('[data-o-editar-marca]')) modalMarca(function () { pintarMarcaOrc(); }); });
      mo.querySelector('[data-gerar]').addEventListener('click', function () {
        var er = mo.querySelector('[data-erro]'), bt = this, d = {};
        mo.querySelectorAll('[data-o]').forEach(function (i) { d[i.getAttribute('data-o')] = i.value.trim(); });
        if (!d.paciente) { er.textContent = 'Preencha o nome do paciente.'; er.hidden = false; return; }
        if (!num(d.valor)) { er.textContent = 'Preencha o valor do tratamento.'; er.hidden = false; return; }
        er.hidden = true; bt.disabled = true; bt.textContent = 'Gerando…';
        if (mo.querySelector('[data-o-salvar]').checked) {
          var sv = { parcelas: d.parcelas, entrada: d.entrada, pagamento: d.pagamento, validade: d.validade, obs: d.obs }; sv[d.pacote] = d.valor;
          post('eap_valores', sv).then(function (j) { if (j.success) C.valores = j.data; }).catch(function () {});
        }
        gerarOrc(d).then(function () { bt.disabled = false; bt.textContent = 'Gerar de novo'; if (window.eapEvento) window.eapEvento('orcamento', 0, d.pacote); })
          .catch(function () { bt.disabled = false; bt.textContent = 'Gerar orçamento (PDF)'; er.textContent = 'Não foi possível gerar agora. Tente de novo.'; er.hidden = false; });
      });
    }
    var g2 = mo._g, V = C.valores, pac = pre.pacote || g2('pacote').value || 'unidade';
    g2('paciente').value = pre.paciente || ''; g2('pacote').value = pac; g2('valor').value = V[pac] || '';
    g2('entrada').value = V.entrada || ''; g2('parcelas').value = V.parcelas || '12'; g2('pagamento').value = V.pagamento || ''; g2('validade').value = V.validade || '15'; g2('obs').value = V.obs || '';
    pintarMarcaOrc(); mo._resumo(); abrirModal(mo);
  }
  function pintarMarcaOrc() {
    var p = mo && mo.querySelector('[data-o-marca]'); if (!p) return;
    p.innerHTML = C.marca && C.marca.nome ? 'O orçamento sai com a sua marca (' + esc(C.marca.nome) + '). <button type="button" class="eap-ferr-link" data-o-editar-marca>Editar</button>'
      : 'Quer o seu logo no orçamento? <button type="button" class="eap-ferr-link" data-o-editar-marca>Colocar minha marca</button>';
  }
  window.eapOrcAbrir = modalOrc;

  function gerarOrc(d) {
    var m = C.marca && C.marca.nome ? C.marca : null;
    return logoDe(m).then(function (logo) {
      var W = 1240, H = 1754, c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d'), M = 96, y = 0, azul = '#2f6fe4', txt = '#1b2433', sub = '#5b6576';
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      // topo
      x.fillStyle = azul; x.fillRect(0, 0, W, 14);
      y = 70;
      var tx = M;
      if (logo) { var r = Math.min(300 / logo.width, 130 / logo.height); x.drawImage(logo, M, y, logo.width * r, logo.height * r); tx = M + logo.width * r + 36; }
      x.textAlign = 'left'; x.fillStyle = txt; x.font = '700 38px ' + FONTE; x.fillText(m ? m.nome : C.dentista.nome, tx, y + 48);
      x.fillStyle = sub; x.font = '500 25px ' + FONTE;
      var lin = []; if (C.dentista.cro) lin.push('CRO ' + C.dentista.cro); if (m && m.whats) lin.push('WhatsApp ' + fone(m.whats)); else if (C.dentista.whats) lin.push('WhatsApp ' + fone(C.dentista.whats));
      if (m && m.insta) lin.push('@' + m.insta); if (m && m.site) lin.push(m.site);
      x.fillText(lin.join('   ·   '), tx, y + 92);
      y = 250; x.fillStyle = '#e4e8f0'; x.fillRect(M, y, W - 2 * M, 2);
      // título
      y += 90; x.fillStyle = azul; x.font = '700 52px ' + FONTE; x.fillText('Proposta de tratamento', M, y);
      y += 48; x.fillStyle = sub; x.font = '500 28px ' + FONTE; x.fillText('Ortodontia com alinhadores transparentes Esthetic Aligner', M, y);
      // paciente e data
      var hoje = new Date(), val = new Date(hoje.getTime() + (parseInt(d.validade, 10) || 15) * 864e5), fd = function (dt) { return dt.toLocaleDateString('pt-BR'); };
      y += 80; caixa(x, M, y, W - 2 * M, 130, '#f5f7fb');
      rotulo(x, 'Paciente', M + 34, y + 48); x.fillStyle = txt; x.font = '700 34px ' + FONTE; caber(x, d.paciente, M + 34, y + 96, 640);
      rotulo(x, 'Data', M + 760, y + 48); x.fillStyle = txt; x.font = '600 30px ' + FONTE; x.fillText(fd(hoje), M + 760, y + 96);
      // plano
      var P = PAC[d.pacote] || PAC.unidade;
      y += 200; rotulo(x, 'Plano indicado', M, y); y += 52; x.fillStyle = txt; x.font = '700 40px ' + FONTE; x.fillText(P.nome, M, y);
      y += 44; x.fillStyle = sub; x.font = '500 28px ' + FONTE; x.fillText('Tempo estimado de tratamento: ' + P.prazo, M, y);
      y += 64;
      ['Planejamento digital 3D do seu sorriso, antes de começar', 'Alinhadores transparentes, removíveis e praticamente invisíveis', 'Consultas de acompanhamento durante todo o tratamento'].forEach(function (t) {
        x.fillStyle = azul; x.beginPath(); x.arc(M + 12, y - 10, 9, 0, 7); x.fill(); x.fillStyle = txt; x.font = '500 29px ' + FONTE; x.fillText(t, M + 40, y); y += 50;
      });
      // valores
      var v = num(d.valor), e = num(d.entrada), p = Math.max(1, parseInt(d.parcelas, 10) || 1);
      y += 40; caixa(x, M, y, W - 2 * M, e ? 300 : 250, '#eef4ff');
      rotulo(x, 'Investimento', M + 34, y + 52); x.fillStyle = azul; x.font = '800 64px ' + FONTE; x.fillText(brl(v), M + 34, y + 130);
      x.fillStyle = txt; x.font = '600 32px ' + FONTE; var yy = y + 190;
      if (e) { x.fillText('Entrada de ' + brl(e), M + 34, yy); yy += 50; }
      x.fillText(v - e > 0 ? (e ? 'Restante em ' : 'Em até ') + p + 'x de ' + brl((v - e) / p) : 'Pagamento à vista', M + 34, yy);
      y += (e ? 300 : 250) + 60;
      if (d.pagamento) { rotulo(x, 'Formas de pagamento', M, y); x.fillStyle = txt; x.font = '500 29px ' + FONTE; caber(x, d.pagamento, M, y + 44, W - 2 * M); y += 100; }
      if (d.obs) { rotulo(x, 'Observações', M, y); x.fillStyle = txt; x.font = '500 27px ' + FONTE; y = quebrar(x, d.obs, M, y + 44, W - 2 * M, 38) + 30; }
      x.fillStyle = sub; x.font = '500 24px ' + FONTE; x.fillText('Proposta válida até ' + fd(val) + '. O tempo de tratamento é uma estimativa e pode variar conforme cada caso.', M, Math.max(y + 10, 1440));
      // assinatura
      var ya = 1590; x.fillStyle = '#c9d3e6'; x.fillRect(W / 2 - 260, ya, 520, 2);
      x.textAlign = 'center'; x.fillStyle = txt; x.font = '600 27px ' + FONTE; x.fillText(C.dentista.nome + (C.dentista.cro ? ' · CRO ' + C.dentista.cro : ''), W / 2, ya + 42);
      x.fillStyle = '#8a93a3'; x.font = '500 21px ' + FONTE; x.fillText('Profissional credenciado Esthetic Aligner', W / 2, ya + 76);
      x.fillStyle = azul; x.fillRect(0, H - 14, W, 14);
      EAPF.baixar(EAPF.pdf([c], 595, 842), 'Orçamento - ' + d.paciente.replace(/[^\wÀ-ú -]+/g, '').slice(0, 50) + '.pdf');
    });
  }
  function caixa(x, X, Y, W, H, cor) { x.fillStyle = cor; var r = 18; x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.fill(); }
  function rotulo(x, t, X, Y) { x.textAlign = 'left'; x.fillStyle = '#8a93a3'; x.font = '700 21px ' + FONTE; x.fillText(t.toUpperCase(), X, Y); }
  function caber(x, t, X, Y, L) { var s = parseInt(x.font.match(/(\d+)px/)[1], 10), pre = x.font.split(/\d+px/)[0]; while (x.measureText(t).width > L && s > 14) { s -= 1; x.font = pre + s + 'px ' + FONTE; } x.fillText(t, X, Y); }
  function quebrar(x, t, X, Y, L, alt) { var ps = t.split(/\s+/), l = ''; ps.forEach(function (p) { var tt = l ? l + ' ' + p : p; if (x.measureText(tt).width > L && l) { x.fillText(l, X, Y); Y += alt; l = p; } else l = tt; }); if (l) { x.fillText(l, X, Y); Y += alt; } return Y; }

  // na página da estimativa: botão fixo + oferta logo depois do resultado
  if (document.querySelector('[data-eap-orc-pagina]')) {
    var cta = el('<div class="eap-orc-cta" hidden><span><b>Pacote indicado:</b> <em data-r></em></span><button type="button" class="eap-btn eap-btn--cheio">Gerar orçamento para o paciente</button><button type="button" class="eap-orc-cta__x" aria-label="Fechar">×</button></div>');
    document.body.appendChild(cta); var ult = {};
    cta.querySelector('.eap-btn').addEventListener('click', function () { modalOrc(ult); });
    cta.querySelector('.eap-orc-cta__x').addEventListener('click', function () { cta.hidden = true; });
    var fixo = el('<button type="button" class="eap-orc-fixo">📄 Orçamento para o paciente</button>'); document.body.appendChild(fixo);
    fixo.addEventListener('click', function () { modalOrc(ult); });
    window.addEventListener('load', function () {
      var o = window.enviarDados; if (typeof o !== 'function') return;
      window.enviarDados = function (dentista, telefone, paciente, email, score, resultado) {
        try { o.apply(this, arguments); } catch (e) {}
        ult = { paciente: paciente || '', pacote: pacoteDe(resultado) }; cta.querySelector('[data-r]').textContent = resultado || ''; cta.hidden = false;
      };
    });
  }
})();
