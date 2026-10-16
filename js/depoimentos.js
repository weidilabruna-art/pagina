/* Carrossel de autoridade + modal de depoimento (Máquina de Vendas)
   FONTE ÚNICA DE DADOS: o array DEPOIMENTOS abaixo.
   Pra adicionar pessoa: copiar um bloco, trocar id e name, deixar o resto null até ter o dado.
   - image: caminho relativo ('depoimentos/nome.webp', 160x160). null = iniciais.
   - username / followers: null = linha escondida (nunca inventar).
   - vimeoUrl: 'vimeo.com/ID', 'vimeo.com/ID/HASH' ou 'player.vimeo.com/video/ID?h=HASH'. null = "em breve".
   - printUrl: imagem (print de depoimento) mostrada no lugar do vídeo quando não há vimeoUrl. null = sem print.
   - vertical: true quando o vídeo é 9:16 (Reels). Se omitido, o código pergunta ao Vimeo e descobre sozinho.
   - role / stat: pra quem não é famoso no Instagram. role aparece no lugar do @ (ex.: 'CEO Móveis Planejados'), stat no lugar dos seguidores (ex.: 'Fatura R$ 1 mi por mês', tem que caber em 1 linha no celular). Deixar username e followers null nesse caso.
   A ordem do array é a ordem de prioridade visual (os dois primeiros aparecem sempre no carregamento). */
const DEPOIMENTOS = [
  { id: 'bruna-arguello',      name: 'Bruna Arguello',      username: 'brunaarguello',      followers: '459 mil seguidores', image: 'depoimentos/bruna-arguello.jpg' },
  { id: 'thiago-dotta',        name: 'Thiago Dotta',        username: 'thiago.dotta',       followers: '156 mil seguidores', image: 'depoimentos/thiago-dotta.jpg' },
  { id: 'nutri-thuany',        name: 'Thuany Lima',         username: 'nutri.thuany',       followers: '1 mi seguidores',   image: 'depoimentos/nutri-thuany.jpg' },
  { id: 'gaby-barbosa',        name: 'Gaby Barbosa',        username: 'gabybarbosa_makeup', followers: '66,5 mil seguidores', image: 'depoimentos/gaby-barbosa.jpg' },
  { id: 'marquinhos-malaquias', name: 'Marcos Malaquias',   username: 'marquinhos_malaquias', followers: '281 mil seguidores', image: 'depoimentos/marquinhos-malaquias.jpg' },
  { id: 'dr-weiviny',          name: 'Dr. Weiviny Ferreira', username: 'dr.weivinyferreira', followers: '12,5 mil seguidores', image: 'depoimentos/dr-weiviny.jpg' },
];

(function () {
  'use strict';
  var section = document.querySelector('.autoridade');
  var viewport = section && section.querySelector('.autoridade-viewport');
  var track = section && section.querySelector('.autoridade-track');
  if (!section || !viewport || !track) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = 28; // px por segundo

  /* ---------- helpers ---------- */
  function avatarHtml(d, size, eager) {
    var inner;
    if (d.image) {
      inner = '<img src="' + d.image + '" width="' + size + '" height="' + size + '" alt="Foto de ' + d.name + '" draggable="false" decoding="async"' +
        (eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"') + '>';
    } else {
      inner = '<span aria-hidden="true">' + d.name.substring(0, 2).toUpperCase() + '</span>';
    }
    return '<div class="autoridade-avatar">' + inner + '</div>';
  }

  function cardHtml(d, index, clone) {
    var meta = '';
    if (d.username) meta += '<div class="autoridade-meta">@' + d.username + '</div>';
    if (d.followers) meta += '<div class="autoridade-meta"><b>' + d.followers + '</b></div>';
    return '<div class="autoridade-card"' +
      (clone ? ' aria-hidden="true"' : '') + '>' +
      avatarHtml(d, 64, !clone && index < 2) +
      '<div class="autoridade-name">' + d.name + '</div>' + meta +
      '</div>';
  }

  /* ---------- render ---------- */
  var setHtml = DEPOIMENTOS.map(function (d, i) { return cardHtml(d, i, false); }).join('');
  track.innerHTML = setHtml;
  var setWidth = 0;
  var copies = 1;

  function measureSet() {
    var cards = track.querySelectorAll('.autoridade-card:not([aria-hidden])');
    if (!cards.length) return 0;
    var gap = parseFloat(getComputedStyle(track).gap) || 12;
    var w = 0;
    cards.forEach(function (c) { w += c.offsetWidth + gap; });
    return w;
  }
  function buildClones() {
    track.querySelectorAll('.autoridade-card[aria-hidden]').forEach(function (c) { c.remove(); });
    setWidth = measureSet();
    if (!setWidth) return;
    var need = Math.max(2, Math.ceil((viewport.offsetWidth * 2) / setWidth) + 1);
    var html = '';
    for (var k = 1; k < need; k++) {
      html += DEPOIMENTOS.map(function (d, i) { return cardHtml(d, i, true); }).join('');
    }
    track.insertAdjacentHTML('beforeend', html);
    copies = need;
  }

  if (reduced) {
    section.classList.add('is-static');
  } else {
    buildClones();
  }

  /* ---------- movimento ---------- */
  var x = 0, last = 0, raf = null, running = !reduced;
  var paused = { hover: false, modal: false, hidden: document.hidden, drag: false };
  var resumeTimer = null;

  function wrap() {
    if (!setWidth) return;
    while (x >= setWidth) x -= setWidth;
    while (x < 0) x += setWidth;
  }
  function apply() { track.style.transform = 'translate3d(' + (-x) + 'px,0,0)'; }
  function isPaused() { return paused.hover || paused.modal || paused.hidden || paused.drag; }
  function tick(ts) {
    if (!running) return;
    if (!last) last = ts;
    var dt = Math.min(64, ts - last);
    last = ts;
    if (!isPaused()) { x += SPEED * dt / 1000; wrap(); apply(); }
    raf = requestAnimationFrame(tick);
  }
  function start() { if (running && !raf) { last = 0; raf = requestAnimationFrame(tick); } }

  if (!reduced) {
    apply();
    start();
    if (window.matchMedia('(hover: hover)').matches) {
      viewport.addEventListener('mouseenter', function () { paused.hover = true; });
      viewport.addEventListener('mouseleave', function () { paused.hover = false; });
    }
    document.addEventListener('visibilitychange', function () { paused.hidden = document.hidden; last = 0; });
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { var old = setWidth; buildClones(); if (old && setWidth) x = x * (setWidth / old); wrap(); apply(); }, 150);
    });

    /* drag / swipe */
    var dragging = false, startX = 0, startOff = 0, moved = 0, pid = null;
    track.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      dragging = true; moved = 0; pid = e.pointerId;
      startX = e.clientX; startOff = x;
      paused.drag = true; clearTimeout(resumeTimer);
      track.classList.add('is-dragging');
      try { track.setPointerCapture(pid); } catch (_) {}
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      x = startOff - dx; wrap(); apply();
    });
    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      track.classList.remove('is-dragging');
      try { track.releasePointerCapture(pid); } catch (_) {}
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () { paused.drag = false; last = 0; }, 1500);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', function (e) {
      if (moved >= 6) {
        e.preventDefault();
        e.stopPropagation();
      }
      moved = 0;
    }, true);
  }
})();
