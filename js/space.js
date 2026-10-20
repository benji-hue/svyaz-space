/* ==========================================================
   Пространство памяти.
   Прокрутка страницы = движение камеры вглубь. Каждая сцена
   висит на своей глубине; фото, тексты и вышитые знаки
   выплывают из темноты и проносятся мимо зрителя.
   ========================================================== */
(function () {
  'use strict';
  const S = window.Stitch;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const C = { red: '#a8142a', glow: '#c92a3f', ink: '#22262b', linen: '#e8e6dd', green: '#36603a' };

  const root = document.documentElement;
  const space = document.getElementById('space');
  const camera = space.querySelector('.camera');
  const world = document.getElementById('world');
  const flight = document.getElementById('flight');
  const veil = document.getElementById('veil');
  const hud = document.getElementById('hud');
  const hudLinks = Array.from(hud.querySelectorAll('a[data-go]'));
  const hudProgress = document.getElementById('hudProgress');
  const hint = document.getElementById('flyHint');
  const topbar = document.getElementById('topbar');
  const scenes = Array.from(world.querySelectorAll('.scene'));
  const N = scenes.length;

  const D = 2600;          // расстояние между сценами
  const FAR = 3300;        // дальше этого ничего не видно
  const P = 900;           // перспектива, как в CSS

  if (reduce) root.classList.add('flat');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- плавная прокрутка ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true, touchMultiplier: 1.4 });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  window.__lenis = lenis;
  window.__seg = () => SEG;
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 2.2 }) : window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

  /* ---------- меню ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  const closeMenu = () => { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  /* ---------- геометрия полёта ---------- */
  let vw = window.innerWidth || 1280, vh = window.innerHeight || 800, SEG = vh * 1.3;
  const items = [];

  function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  // 30 фигур «каждого третьего»
  const FIG = ['...XXX...', '..XXXXX..', '...XXX...', '....X....', '.XXXXXXX.', 'X.XXXXX.X', 'X.XXXXX.X',
    '..XXXXX..', '..XXXXX..', '..XX.XX..', '..X...X..', '..X...X..', '.XX...XX.'].map((r) => Array.from(r).map((c) => c === 'X'));
  const figWrap = document.getElementById('spaceFigures');
  if (figWrap) {
    const rnd = seeded(31);
    for (let i = 0; i < 30; i++) {
      const el = document.createElement('div');
      el.className = 'item figure-item';
      const c = document.createElement('canvas');
      c.width = 90; c.height = 130;
      const lost = i % 3 === 2;
      S.drawGrid(c, FIG, lost ? '#4a4f57' : C.linen);
      el.appendChild(c);
      // фигуры стоят рядами слева от текста, уходя вглубь
      const col = i % 5, row = Math.floor(i / 5);
      el.dataset.x = (-50 + col * 9 + (rnd() - 0.5) * 2).toFixed(1);
      el.dataset.y = (-34 + (row % 3) * 30 + (rnd() - 0.5) * 4).toFixed(1);
      el.dataset.z = Math.round(380 + Math.floor(row / 3) * 520 + (row % 3) * 60 + rnd() * 80);
      el.style.setProperty('--w', '5.2vw');
      if (lost) el.dataset.lost = '1';
      figWrap.appendChild(el);
    }
  }

  // 149 крестиков Хатыни: 75 красных (дети), 74 светлых (взрослые)
  const crossWrap = document.getElementById('spaceCrosses');
  if (crossWrap) {
    const rnd = seeded(1943);
    const kinds = Array(75).fill(1).concat(Array(74).fill(0));
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    kinds.forEach((child, i) => {
      const el = document.createElement('div');
      el.className = 'item xcross';
      let x = (rnd() - 0.5) * 130, y = (rnd() - 0.5) * 100;
      if (Math.abs(x) < 16 && Math.abs(y) < 14) x += x < 0 ? -18 : 18; // не закрываем центр
      el.dataset.x = x.toFixed(1);
      el.dataset.y = y.toFixed(1);
      el.dataset.z = Math.round(260 + (i / kinds.length) * 2000 + rnd() * 200);
      el.dataset.kind = 'cross';
      el.style.setProperty('--c', child ? C.glow : C.linen);
      const s = 14 + rnd() * 14;
      el.style.width = el.style.height = s + 'px';
      crossWrap.appendChild(el);
    });
  }

  function collect() {
    items.length = 0;
    scenes.forEach((sc, i) => {
      const anchor = i * D;
      sc.querySelectorAll('.item').forEach((el) => {
        let kind = 'other';
        if (el.classList.contains('panel')) kind = 'panel';
        else if (el.classList.contains('photo--frame')) kind = 'frame';
        else if (el.classList.contains('photo')) kind = 'photo';
        else if (el.classList.contains('year-ghost') || el.classList.contains('word-ghost')) kind = 'ghost';
        else if (el.dataset.kind === 'cross') kind = 'cross';
        items.push({
          el, kind, scene: i,
          z0: anchor + parseFloat(el.dataset.z || 0),
          x0: parseFloat(el.dataset.x || 0),
          y0: parseFloat(el.dataset.y || 0),
          lost: el.dataset.lost === '1',
          op: -1, off: null
        });
      });
    });
  }

  function layout() {
    vw = window.innerWidth || 1280; vh = window.innerHeight || 800;
    SEG = vh * (vw < 760 ? 1.1 : 1.3);
    // N сцен + один дополнительный отрезок на «приземление»
    flight.style.height = (N * SEG + vh) + 'px';
    const narrow = vw < 760;
    items.forEach((it) => {
      let x = it.x0, y = it.y0, z = it.z0;
      if (narrow && it.kind === 'panel') { x = 0; y = 6; z = it.z0 - 60; }
      if (narrow && it.kind === 'frame') { x = Math.sign(x) * 24; y = it.y0 < 0 ? -78 : 78; }
      if (narrow && it.kind === 'cross') { x = it.x0 * 1.7; y = it.y0 * 1.3; }
      if (narrow && it.kind === 'ghost') { x = it.x0 * 0.6; y = it.y0 * 1.4; }
      if (it.kind === 'photo') {
        // на вертикальном экране фото растягиваем по высоте, чтобы оно заполняло кадр
        if (it.w0 === undefined) it.w0 = parseFloat(it.el.style.getPropertyValue('--w')) || 190;
        const k = vh > vw ? Math.max(1, (vh / vw) * 0.8) : 1;
        it.el.style.setProperty('--w', (it.w0 * k).toFixed(1) + 'vw');
        if (narrow) z = it.z0 - 450;
      }
      it.x = (x / 100) * vw; it.y = (y / 100) * vh; it.z = z;
      it.el.style.transform = `translate(-50%, -50%) translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, ${(-it.z).toFixed(1)}px)`;
    });
    dustResize();
    update(true);
  }

  /* ---------- камера ---------- */
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  let cam = 0, camPrev = 0, sFloat = 0;
  // фон сцен: чуть меняем «воздух» эпох
  const AIR = ['#171b21', '#1b1d21', '#191b20', '#171a1f', '#1a1a1c', '#1e1a19', '#1a1c21', '#171c22', '#1b1c22', '#0f1420', '#161b22'];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };

  function update(force) {
    if (reduce) return;
    const y = window.scrollY;
    const total = N * SEG;
    const s = Math.max(0, Math.min(N, y / SEG)) || 0;
    const i = Math.min(N - 1, Math.floor(s));
    const t = s - i;
    const camNew = i * D + D * smoother(Math.min(1, t));
    if (!force && Math.abs(camNew - cam) < 0.05 && Math.abs(s - sFloat) < 0.0005) return;
    camPrev = cam; cam = camNew; sFloat = s;

    world.style.transform = `translate3d(0, 0, ${cam.toFixed(1)}px)`;

    for (const it of items) {
      const d = it.z - cam;
      let o;
      if (d > FAR || d < -60) o = 0;
      else {
        const far = Math.min(1, (FAR - d) / 800);
        let near;
        switch (it.kind) {
          case 'panel': near = (d - 20) / 150; break;
          case 'photo': near = (d - 60) / 650; break;
          case 'frame': near = (d - 40) / 320; break;
          case 'ghost': near = (d - 80) / 500; break;
          case 'cross': near = (d + 20) / 160; break;
          default: near = (d - 30) / 260;
        }
        o = Math.max(0, Math.min(1, far, near));
        if (it.kind === 'ghost') o *= 0.9;
        if (it.lost) o *= 0.55;
      }
      const off = o <= 0.001;
      if (off !== it.off) { it.el.classList.toggle('is-off', off); it.off = off; }
      if (!off && Math.abs(o - it.op) > 0.004) { it.el.style.opacity = o.toFixed(3); it.op = o; }
    }

    // цвет «воздуха» и приземление
    const ai = Math.min(AIR.length - 1, Math.floor(s)), at = s - ai;
    space.style.backgroundColor = mix(AIR[ai], AIR[Math.min(AIR.length - 1, ai + 1)], smoother(Math.min(1, at)));
    const land = Math.max(0, Math.min(1, (s - (N - 1) - 0.35) / 0.55));
    veil.style.opacity = land.toFixed(3);

    // приборы
    const active = Math.min(N - 1, Math.round(s));
    hudLinks.forEach((a, k) => a.classList.toggle('is-active', k === active));
    hudProgress.style.transform = `scaleY(${Math.min(1, s / (N - 1)).toFixed(4)})`;
    const inFlight = y < total + vh * 0.4;
    hud.classList.toggle('is-hidden', !inFlight || land > 0.5);
    hint.classList.toggle('is-hidden', y > 40);
    topbar.classList.toggle('on-dark', y < total + vh * 0.55 && land < 0.6);
    topbar.classList.toggle('is-solid', y > total + vh * 0.55);
    space.classList.toggle('is-gone', y > total + vh * 1.2);
  }

  /* ---------- частицы: пепел и пыль, летящие навстречу ---------- */
  const dust = document.getElementById('dust');
  const dctx = dust.getContext('2d');
  let parts = [], dpr = 1;
  function dustResize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    dust.width = Math.round(vw * dpr); dust.height = Math.round(vh * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = vw < 760 ? 110 : 240;
    if (parts.length !== count) {
      const rnd = seeded(7);
      parts = Array.from({ length: count }, () => ({
        x: (rnd() - 0.5) * vw * 2.4, y: (rnd() - 0.5) * vh * 2.4,
        z: rnd() * FAR, r: 0.6 + rnd() * 1.6, drift: 0.2 + rnd() * 0.5, tw: rnd() * 6.28
      }));
    }
  }
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('pointermove', (e) => { tmx = e.clientX / vw - 0.5; tmy = e.clientY / vh - 0.5; }, { passive: true });

  function frame(time) {
    if (!reduce) {
      // мягкий параллакс за курсором: смещаем точку схода
      mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      camera.style.perspectiveOrigin = `${(50 + mx * 7).toFixed(2)}% ${(50 + my * 7).toFixed(2)}%`;
      update(false);
      drawDust(time || 0);
    }
    requestAnimationFrame(frame);
  }

  let lastCam = 0;
  function drawDust(time) {
    const v = cam - lastCam; lastCam = cam;
    dctx.clearRect(0, 0, vw, vh);
    const ox = vw * (0.5 + mx * 0.07), oy = vh * (0.5 + my * 0.07);
    const ember = Math.max(0, 1 - Math.abs(sFloat - 5) / 0.9); // в Хатыни пыль становится пеплом с искрами
    const streak = Math.min(1, Math.abs(v) / 40);
    for (const p of parts) {
      p.y -= p.drift * (0.6 + ember);
      let d = p.z - cam % FAR;
      if (d < 0) d += FAR;
      if (d < 4) continue;
      const k = P / (P + d);
      const sx = ox + p.x * k, sy = oy + (p.y % (vh * 1.2)) * k;
      if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;
      const a = Math.min(1, (FAR - d) / 900) * Math.min(1, d / 200) * (0.35 + 0.25 * Math.sin(time / 900 + p.tw));
      const isEmber = ember > 0 && p.tw < 6.28 * 0.3 * ember;
      dctx.strokeStyle = dctx.fillStyle = isEmber ? `rgba(201, 42, 63, ${(a * 1.6).toFixed(3)})` : `rgba(232, 230, 221, ${a.toFixed(3)})`;
      const r = p.r * k * 2.2;
      if (streak > 0.05) {
        // при быстром полёте частицы вытягиваются в штрихи
        const k2 = P / (P + d + v * 3);
        dctx.lineWidth = Math.max(0.5, r);
        dctx.beginPath();
        dctx.moveTo(sx, sy);
        dctx.lineTo(ox + p.x * k2, oy + (p.y % (vh * 1.2)) * k2);
        dctx.stroke();
      } else {
        dctx.beginPath(); dctx.arc(sx, sy, Math.max(0.4, r), 0, 6.283); dctx.fill();
      }
    }
  }

  /* ---------- вышитое «ПАМЯТАЕМ» в первой сцене ---------- */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const heroCanvas = document.getElementById('spaceStitch');
  function stitchHero(animate) {
    if (!heroCanvas) return;
    const w = heroCanvas.clientWidth || Math.min(880, vw * 0.88);
    const R = 25, h = w / 4.4;
    const ctx = S.fit(heroCanvas, w, h);
    const s = h / R, cols = Math.floor(w / s);
    const cells = [];
    for (let yy = 0; yy < 4; yy++) for (let x = 0; x < cols; x++) {
      const dx = Math.abs((x % 6) - 3), dy = Math.abs(yy - 1.5);
      if (Math.round(dx + dy) === 2) { cells.push({ x, y: yy, c: C.linen }); cells.push({ x, y: R - 1 - yy, c: C.linen }); }
    }
    let rows = 13, tg;
    do { tg = S.textToGrid('ПАМЯТАЕМ', rows, '600 {px} Golos, sans-serif'); rows--; } while (tg[0].length > cols - 4 && rows > 6);
    const oy = 6 + Math.floor((13 - tg.length) / 2), ox = Math.floor((cols - tg[0].length) / 2);
    tg.forEach((row, yy) => row.forEach((v, x) => { if (v) cells.push({ x: ox + x, y: oy + yy, c: C.glow }); }));
    const off = (w - cols * s) / 2;
    const list = cells.map((c) => ({ px: off + c.x * s, py: c.y * s, c: c.c, k: c.x + Math.random() * 3 })).sort((a, b) => a.k - b.k);
    if (!animate) { list.forEach((c) => S.cross(ctx, c.px, c.py, s, c.c)); return; }
    const n = list.length, p1 = 1300, p2 = 1000, t0 = performance.now();
    let i1 = 0, i2 = 0;
    (function step(now) {
      const t = now - t0;
      const a = Math.min(n, Math.floor((t / p1) * n));
      for (; i1 < a; i1++) S.halfStitch(ctx, list[i1].px, list[i1].py, s, list[i1].c, 0, 1);
      if (t > p1) {
        const b = Math.min(n, Math.floor(((t - p1) / p2) * n));
        for (; i2 < b; i2++) { const c = list[n - 1 - i2]; S.halfStitch(ctx, c.px, c.py, s, c.c, 1, 1); }
      }
      if (i2 < n) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- статичные знаки, монограммы, рушник ---------- */
  document.querySelectorAll('canvas[data-motif]').forEach((c) => S.drawGrid(c, S.patternToGrid(c.dataset.motif), c.dataset.color));
  function monogramGrid(text) {
    const M = 20;
    let rows = 10, tg;
    do { tg = S.textToGrid(text, rows, '700 {px} Golos, sans-serif'); rows--; } while (tg[0].length > M - 5 && rows > 5);
    const g = Array.from({ length: M }, () => Array(M).fill(false));
    const oy = Math.floor((M - tg.length) / 2), ox = Math.floor((M - tg[0].length) / 2);
    tg.forEach((row, y) => row.forEach((v, x) => { if (v) g[oy + y][ox + x] = C.ink; }));
    for (let i = 0; i < M; i += 2) { g[0][i] = g[M - 1][i] = g[i][0] = g[i][M - 1] = C.red; }
    return g;
  }

  const rush = document.getElementById('rushnik');
  function drawRushnik(progress) {
    if (!rush) return;
    const w = rush.clientWidth;
    const s = Math.max(5, Math.min(9, w / 150)), R = 25, cols = Math.floor(w / s);
    const ctx = S.fit(rush, w, R * s);
    const cells = [];
    const star = S.patternToGrid('ruzha'), ber = S.patternToGrid('bereginya');
    for (let x = 0; x < cols; x++) {
      if (x % 2 === 0) { cells.push({ x, y: 0, c: C.ink }); cells.push({ x, y: R - 1, c: C.ink }); }
      const dx = Math.abs((x % 4) - 2);
      if (dx <= 1) { cells.push({ x, y: 2 + dx, c: C.red }); cells.push({ x, y: R - 3 - dx, c: C.red }); }
    }
    const step = 19, count = Math.floor((cols - 2) / step), ox = Math.floor((cols - count * step) / 2) + 2;
    for (let k = 0; k < count; k++) {
      const m = k % 2 ? ber : star, col = k % 2 ? C.ink : C.red;
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (m[y][x]) cells.push({ x: ox + k * step + x, y: 5 + y, c: col });
    }
    cells.sort((a, b) => a.x - b.x);
    const n = Math.floor(cells.length * progress), off = (w - cols * s) / 2;
    for (let i = 0; i < n; i++) S.cross(ctx, off + cells[i].x * s, cells[i].y * s, s, cells[i].c);
  }

  /* ---------- колокол Хатыни ---------- */
  const bellCount = document.getElementById('bellCount');
  let sec = 30;
  setInterval(() => { sec = sec <= 1 ? 30 : sec - 1; if (bellCount) bellCount.textContent = sec; }, 1000);

  /* ---------- переходы по ссылкам ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      closeMenu();
      if (a.dataset.go !== undefined) {
        e.preventDefault();
        if (reduce) { document.querySelector(a.getAttribute('href')).scrollIntoView(); return; }
        scrollToY(parseInt(a.dataset.go, 10) * SEG + 2);
        return;
      }
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -10, duration: 2.2 }); else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- запуск ---------- */
  collect();
  layout();
  let lastW = vw, lastH = vh;
  window.addEventListener('resize', () => {
    // на телефоне адресная строка меняет высоту — не перестраиваем из-за мелочей
    if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(window.innerHeight - lastH) < 120) return;
    lastW = window.innerWidth; lastH = window.innerHeight;
    layout();
    stitchHero(false);
    if (hasGsap) ScrollTrigger.refresh();
  });
  requestAnimationFrame(frame);
  window.addEventListener('scroll', () => update(false), { passive: true });

  fontsReady.then(() => {
    stitchHero(!reduce);
    document.querySelectorAll('canvas[data-letter]').forEach((c) => S.drawGrid(c, monogramGrid(c.dataset.letter), C.ink));
    if (hasGsap) ScrollTrigger.refresh();
  });

  if (hasGsap && !reduce) {
    ScrollTrigger.batch('.ground .reveal', {
      start: 'top 88%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', stagger: 0.08 })
    });
    const r = { p: 0 };
    drawRushnik(0);
    ScrollTrigger.create({
      trigger: '#rushnik', start: 'top 90%', once: true,
      onEnter: () => gsap.to(r, { p: 1, duration: 2.6, ease: 'power1.inOut', onUpdate: () => drawRushnik(r.p) })
    });
    window.addEventListener('resize', () => drawRushnik(r.p));
    // первая сцена появляется из темноты
    gsap.from(camera, { opacity: 0, duration: 1.6, ease: 'power2.out' });
  } else {
    drawRushnik(1);
    document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
    window.addEventListener('resize', () => drawRushnik(1));
  }
})();
