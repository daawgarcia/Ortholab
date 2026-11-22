/* EA Portal – ferramentas no navegador: PDF simples a partir de imagens, carregar imagem e fonte, baixar arquivo. */
(function () {
  var E = window.EAPF = {};
  E.img = function (src) {
    return new Promise(function (ok, erro) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = erro; i.src = src; });
  };
  E.fonte = function (nome, url) {
    if (!window.FontFace) return Promise.resolve();
    var f = new FontFace(nome, 'url(' + url + ')');
    return f.load().then(function (x) { document.fonts.add(x); }).catch(function () {});
  };
  E.baixar = function (blob, nome) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  function bytesDe(dataUrl) { var b = atob(dataUrl.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  /* páginas: lista de canvas; cada um vira uma página (tamanho em pontos: pw x ph) */
  E.pdf = function (canvases, pw, ph) {
    var partes = [], tam = 0, offs = [], enc = new TextEncoder();
    function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; partes.push(u); tam += u.length; }
    function obj(n, corpo) { offs[n] = tam; add(n + ' 0 obj\n'); corpo(); add('\nendobj\n'); }
    var n = canvases.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, function () { add('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { add('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
    canvases.forEach(function (c, i) {
      var p = 3 + i * 3, img = bytesDe(c.toDataURL('image/jpeg', 0.92)), cont = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im' + i + ' Do Q';
      obj(p, function () { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im' + i + ' ' + (p + 1) + ' 0 R >> >> /Contents ' + (p + 2) + ' 0 R >>'); });
      obj(p + 1, function () { add('<< /Type /XObject /Subtype /Image /Width ' + c.width + ' /Height ' + c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n'); add(img); add('\nendstream'); });
      obj(p + 2, function () { add('<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream'); });
    });
    var xref = tam, total = 3 + n * 3;
    add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var k = 1; k < total; k++) add(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
    add('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(partes, { type: 'application/pdf' });
  };
  /* escreve um texto centralizado reduzindo a fonte até caber na largura */
  E.textoCabe = function (ctx, txt, x, y, larg, tamMax, fonte) {
    var t = tamMax; do { ctx.font = t + 'px ' + fonte; t -= 2; } while (ctx.measureText(txt).width > larg && t > 10);
    ctx.fillText(txt, x, y);
  };
})();
