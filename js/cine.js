/* ==========================================================
   Кинорежим. Прокрутка страницы = плёнка: каждая сцена
   держится на экране, затем следующая заходит диагональной
   шторкой, по краю которой бежит красная нить.
   ========================================================== */
(function () {
  'use strict';
  const S = window.Stitch;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const C = { red: '#a8142a', glow: '#d4283f', ink: '#22262b', linen: '#e8e6dd' };

  const root = document.documentElement;
  const film = document.getElementById('film');
  const flight = document.getElementById('flight');
  const veil = document.getElementById('veil');
  const seam = document.getElementById('seam');
  const chapters = document.getElementById('chapters');
  const chapterLinks = Array.from(chapters.querySelectorAll('a[data-go]'));
  const bar = document.getElementById('bar');
  const barCur = document.getElementById('barCur');
  const barTot = document.getElementById('barTot');
  const barFill = document.getElementById('barFill');
  const barPlace = document.getElementById('barPlace');
  const barHint = bar.querySelector('.bar-hint');
  const topbar = document.getElementById('topbar');
  const scenes = Array.from(film.querySelectorAll('.scene'));
  const N = scenes.length;

  const HOLD = 0.55;           // доля отрезка, когда кадр просто стоит
  const WIPE = 1 - HOLD;       // доля отрезка на смену кадра
  const SLANT = 25;            // наклон шторки, % высоты

  if (reduce) root.classList.add('flat');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- плавная прокрутка ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 3), smoothWheel: true, touchMultiplier: 1.3 });
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
  const scrollToY = (y, d = 1.8) => (lenis ? lenis.scrollTo(y, { duration: d }) : window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

  /* ---------- меню ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const nav = document.getElementById('nav');
  const closeMenu = () => { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  /* ---------- заголовки: каждое слово в своей «маске» ---------- */
  document.querySelectorAll('.scene .title').forEach((title) => {
    let i = 0;
    title.querySelectorAll('[data-split]').forEach((el) => split(el));
    if (title.hasAttribute('data-split')) split(title);
    function split(el) {
      const words = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      words.forEach((w, k) => {
        const outer = document.createElement('span');
        outer.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = w;
        inner.style.setProperty('--i', i++);
        outer.appendChild(inner);
        el.appendChild(outer);
        if (k < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    }
  });

  function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  /* ---------- «каждый третий»: 30 фигур, каждая третья погасла ---------- */
  const FIG = ['...XXX...', '..XXXXX..', '...XXX...', '....X....', '.XXXXXXX.', 'X.XXXXX.X', 'X.XXXXX.X',
    '..XXXXX..', '..XXXXX..', '..XX.XX..', '..X...X..', '..X...X..', '.XX...XX.'].map((r) => Array.from(r).map((c) => c === 'X'));
  const figWrap = document.getElementById('spaceFigures');
  if (figWrap) {
    for (let i = 0; i < 30; i++) {
      const c = document.createElement('canvas');
      c.width = 90; c.height = 130;
      const lost = i % 3 === 2;
      S.drawGrid(c, FIG, lost ? '#4a4f57' : C.linen);
      if (lost) c.className = 'is-lost';
      c.style.setProperty('--k', (i / 30).toFixed(3));
      figWrap.appendChild(c);
    }
  }

  /* ---------- Хатынь: 149 крестиков, 75 красных (дети) ---------- */
  const crossWrap = document.getElementById('spaceCrosses');
  if (crossWrap) {
    const rnd = seeded(1943);
    const kinds = Array(75).fill(1).concat(Array(74).fill(0));
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    kinds.forEach((child, i) => {
      const el = document.createElement('i');
      el.className = 'xc ' + (child ? 'is-child' : 'is-adult');
      el.style.setProperty('--k', (i / kinds.length).toFixed(3));
      crossWrap.appendChild(el);
    });
  }

  /* ---------- геометрия ---------- */
  let vw = window.innerWidth || 1280, vh = window.innerHeight || 800, SEG = vh;
  function layout() {
    vw = window.innerWidth || 1280; vh = window.innerHeight || 800;
    SEG = vh * (vw < 760 ? 1.0 : 1.15);
    flight.style.height = (N * SEG + vh) + 'px';
    dustResize();
    update(true);
  }

  /* ---------- плёнка ---------- */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const st = scenes.map((el) => ({ el, bg: el.querySelector('.bg'), off: null, clip: '', tin: -1, tout: -1, p: -9, tf: '', z: -1 }));
  let intro = reduce ? 1 : 0, sFloat = 0, wasGone = false, lastActive = -1, lastFill = -1, lastLand = -1, mx = 0, my = 0;
  const cls = (el, name, on) => { const c = el._c || (el._c = {}); if (c[name] === on) return; c[name] = on; el.classList.toggle(name, on); };
  const setVar = (el, name, v, prev) => { if (Math.abs(v - prev) > 0.0005) el.style.setProperty(name, v.toFixed(4)); return v; };

  function update(force) {
    if (reduce) return;
    const y = window.scrollY;
    if (y > N * SEG + vh) {
      // мы уже «на земле»: плёнку не считаем
      if (!wasGone) {
        wasGone = true; cls(film, 'is-gone', true); cls(chapters, 'is-hidden', true); cls(bar, 'is-hidden', true);
        cls(topbar, 'on-dark', false); cls(topbar, 'is-solid', true);
      }
      return;
    }
    if (wasGone) { wasGone = false; force = true; cls(film, 'is-gone', false); }
    const s = Math.max(0, Math.min(N, y / SEG)) || 0;
    sFloat = s;

    let wiping = -1, wipeIn = 0;
    for (let i = 0; i < N; i++) {
      const o = st[i];
      const inn = i === 0 ? 1 : ease(clamp01((s - i + WIPE) / WIPE));
      const nextIn = i === N - 1 ? 0 : ease(clamp01((s - i - 1 + WIPE) / WIPE));
      const off = inn <= 0 || nextIn >= 1;
      if (off !== o.off) { o.el.classList.toggle('is-off', off); o.off = off; }
      if (off) continue;
      if (o.z !== i + 1) { o.el.style.zIndex = i + 1; o.z = i + 1; }

      // шторка
      let clip = 'none';
      if (inn < 1) {
        const yl = (1 - inn) * (100 + SLANT), yr = yl - SLANT;
        clip = `polygon(0 ${yl.toFixed(2)}%, 100% ${yr.toFixed(2)}%, 100% 100%, 0 100%)`;
        wiping = i; wipeIn = inn;
      }
      if (clip !== o.clip) { o.el.style.clipPath = clip; o.clip = clip; }

      // текст и параллакс
      const tin = i === 0 ? intro : clamp01((inn - 0.35) / 0.65);
      const tout = nextIn;
      const p = s - i;
      o.tin = setVar(o.el, '--tin', tin, o.tin);
      o.tout = setVar(o.el, '--tout', tout, o.tout);
      o.p = setVar(o.el, '--p', p, o.p);
      const sc = 1 + 0.14 * (1 - inn) + 0.05 * clamp01((p + WIPE) / (1 + WIPE));
      const tf = `translate3d(${(mx * -14).toFixed(1)}px, ${(my * -10 + p * -2.2 * vh / 100).toFixed(1)}px, 0) scale(${sc.toFixed(4)})`;
      if (tf !== o.tf) { o.bg.style.transform = tf; o.tf = tf; }
    }

    // красная нить по краю шторки
    if (wiping >= 0) {
      const yl = (1 - wipeIn) * (100 + SLANT) * vh / 100, yr = yl - SLANT * vh / 100;
      const ang = Math.atan2(yr - yl, vw) * 180 / Math.PI;
      seam.style.transform = `translate3d(0, ${yl.toFixed(1)}px, 0) rotate(${ang.toFixed(2)}deg)`;
      seam.style.opacity = Math.min(1, wipeIn * 6, (1 - wipeIn) * 6).toFixed(3);
    } else if (seam.style.opacity !== '0') seam.style.opacity = '0';

    // приборы
    const active = Math.min(N - 1, Math.round(s - 0.1));
    if (active !== lastActive) {
      chapterLinks.forEach((el, k) => el.classList.toggle('is-active', k === active));
      barCur.textContent = String(active).padStart(2, '0');
      barPlace.textContent = scenes[active].dataset.place || '';
      lastActive = active;
    }
    const fill = Math.min(1, s / (N - 1));
    if (Math.abs(fill - lastFill) > 0.001) { barFill.style.transform = `scaleX(${fill.toFixed(4)})`; lastFill = fill; }
    cls(barHint, 'is-done', y > 40);

    // приземление
    const land = clamp01((s - (N - WIPE)) / WIPE);
    if (Math.abs(land - lastLand) > 0.002) { veil.style.opacity = land.toFixed(3); lastLand = land; }
    cls(chapters, 'is-hidden', land > 0.4);
    cls(bar, 'is-hidden', land > 0.4);
    cls(topbar, 'on-dark', land < 0.9);
    cls(topbar, 'is-solid', y > N * SEG + vh * 0.5);
  }

  /* ---------- пепел: медленно поднимается, в Хатыни — искры ---------- */
  const dust = document.getElementById('dust');
  const dctx = dust.getContext('2d');
  let parts = [];
  function dustResize() {
    dust.width = vw; dust.height = vh;
    const count = vw < 760 ? 46 : 110;
    if (parts.length !== count) {
      const rnd = seeded(7);
      parts = Array.from({ length: count }, () => ({
        x: rnd() * vw, y: rnd() * vh, z: 0.3 + rnd() * 0.7, r: 0.5 + rnd() * 1.5, sp: 0.15 + rnd() * 0.45, ph: rnd() * 6.28, hot: rnd()
      }));
    }
  }
  let tmx = 0, tmy = 0, lastY = window.scrollY;
  window.addEventListener('pointermove', (e) => { tmx = e.clientX / vw - 0.5; tmy = e.clientY / vh - 0.5; }, { passive: true });

  function drawDust(time, dt) {
    const ember = Math.max(0, 1 - Math.abs(sFloat - 5) / 0.8);
    const dy = window.scrollY - lastY; lastY = window.scrollY;
    const k = dt / 16.7;
    dctx.clearRect(0, 0, vw, vh);
    for (const p of parts) {
      p.y -= p.sp * p.z * (1 + ember * 1.6) * k + dy * 0.05 * p.z;
      p.x += Math.sin(time / 1600 + p.ph) * 0.18 * p.z * k;
      if (p.y < -10) { p.y = vh + 10; p.x = Math.random() * vw; }
      if (p.y > vh + 10) { p.y = -10; }
      const sx = p.x + mx * -30 * p.z, sy = p.y + my * -20 * p.z;
      const a = (0.25 + 0.35 * p.z) * (0.6 + 0.4 * Math.sin(time / 700 + p.ph));
      const r = p.r * p.z * 1.6;
      if (ember > 0 && p.hot < 0.45 * ember) {
        dctx.fillStyle = `rgba(232, 70, 60, ${(a * ember + 0.1).toFixed(3)})`;
        dctx.fillRect(sx - r, sy - r, r * 2.2, r * 2.2);
      } else {
        dctx.fillStyle = `rgba(232, 230, 221, ${(a * 0.7).toFixed(3)})`;
        dctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
    }
  }

  /* ---------- качество подстраивается под устройство ---------- */
  const qs = location.search;
  const forced = qs.match(/[?&]level=(\d)/);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!(navigator.connection && navigator.connection.saveData);
  let level = 0;
  function setLevel(l) {
    level = Math.max(0, Math.min(3, l));
    for (let k = 1; k <= 3; k++) root.classList.toggle('perf-' + k, k <= level);
    if (level >= 2) dctx.clearRect(0, 0, vw, vh);
  }
  setLevel(forced ? +forced[1] : weak || coarse ? 1 : 0);

  let lastT = 0, acc = 0, accN = 0, prevS = 0;
  function frame(time) {
    const dt = lastT ? Math.min(100, time - lastT) : 16; lastT = time;
    if (!reduce) {
      if (!coarse) { mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06; }
      update(false);
      if (!wasGone && level < 2) drawDust(time, dt);
      const moving = Math.abs(sFloat - prevS) > 0.0005; prevS = sFloat;
      if (!forced && moving && time > 4000 && dt < 250) {
        acc += dt; accN++;
        if (accN >= 50) { if (acc / accN > 26 && level < 3) setLevel(level + 1); acc = 0; accN = 0; }
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- кадр не останавливается на середине шторки ---------- */
  if (lenis) {
    let snapT = 0, snapping = false;
    lenis.on('scroll', () => {
      clearTimeout(snapT);
      if (snapping) return;
      snapT = setTimeout(() => {
        const y = window.scrollY, s = y / SEG;
        if (s <= 0 || s >= N - 1) return;
        const f = s - Math.floor(s);
        if (f <= HOLD + 0.03 || f >= 0.985) return;
        const target = (f < HOLD + WIPE / 2 ? Math.floor(s) + HOLD - 0.02 : Math.ceil(s) + 0.01) * SEG;
        snapping = true;
        lenis.scrollTo(target, { duration: 0.9, onComplete: () => { snapping = false; } });
        setTimeout(() => { snapping = false; }, 1100);
      }, 260);
    });
  }

  /* ---------- вышитое «ПАМЯТАЕМ» в первой сцене ---------- */
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const heroCanvas = document.getElementById('spaceStitch');
  function stitchHero(animate) {
    if (!heroCanvas) return;
    const w = heroCanvas.clientWidth || Math.min(700, vw * 0.7);
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

  /* ---------- знаки, монограммы, рушник ---------- */
  document.querySelectorAll('canvas[data-motif]').forEach((c) => S.drawGrid(c, S.patternToGrid(c.dataset.motif), c.dataset.color));
  function monogramGrid(text) {
    const M = 20;
    let rows = 10, tg;
    do { tg = S.textToGrid(text, rows, '700 {px} Golos, sans-serif'); rows--; } while (tg[0].length > M - 5 && rows > 5);
    const g = Array.from({ length: M }, () => Array(M).fill(false));
    const oy = Math.floor((M - tg.length) / 2), ox = Math.floor((M - tg[0].length) / 2);
    tg.forEach((row, y) => row.forEach((v, x) => { if (v) g[oy + y][ox + x] = C.linen; }));
    for (let i = 0; i < M; i += 2) { g[0][i] = g[M - 1][i] = g[i][0] = g[i][M - 1] = C.glow; }
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
      if (x % 2 === 0) { cells.push({ x, y: 0, c: C.linen }); cells.push({ x, y: R - 1, c: C.linen }); }
      const dx = Math.abs((x % 4) - 2);
      if (dx <= 1) { cells.push({ x, y: 2 + dx, c: C.glow }); cells.push({ x, y: R - 3 - dx, c: C.glow }); }
    }
    const step = 19, count = Math.floor((cols - 2) / step), ox = Math.floor((cols - count * step) / 2) + 2;
    for (let k = 0; k < count; k++) {
      const m = k % 2 ? ber : star, col = k % 2 ? C.linen : C.glow;
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (m[y][x]) cells.push({ x: ox + k * step + x, y: 5 + y, c: col });
    }
    cells.sort((a, b) => a.x - b.x);
    const n = Math.floor(cells.length * progress), off = (w - cols * s) / 2;
    for (let i = 0; i < n; i++) S.cross(ctx, off + cells[i].x * s, cells[i].y * s, s, cells[i].c);
  }

  /* ---------- колокол Хатыни ---------- */
  const bell = document.getElementById('bell');
  const bellCount = document.getElementById('bellCount');
  let sec = 30;
  setInterval(() => {
    sec = sec <= 1 ? 30 : sec - 1;
    if (bellCount) bellCount.textContent = sec;
    if (bell) {
      bell.style.setProperty('--bell', (sec / 30).toFixed(3));
      if (sec === 30) { bell.classList.remove('is-ringing'); void bell.offsetWidth; bell.classList.add('is-ringing'); }
    }
  }, 1000);
  if (bell) bell.style.setProperty('--bell', '1');

  /* ---------- переходы по ссылкам ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      closeMenu();
      if (a.dataset.go !== undefined) {
        e.preventDefault();
        if (reduce) { document.querySelector(a.getAttribute('href')).scrollIntoView(); return; }
        const g = parseInt(a.dataset.go, 10);
        scrollToY(g === 0 ? 0 : g * SEG + 2, 1.6);
        return;
      }
      const el = document.querySelector(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -10, duration: 2.2 }); else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- фото декодируем заранее, по одному ---------- */
  window.addEventListener('load', () => {
    const imgs = Array.from(film.querySelectorAll('img'));
    let n = 0;
    (function next() {
      if (n >= imgs.length) return;
      const im = imgs[n++];
      (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => setTimeout(next, 60));
    })();
  });

  /* ---------- запуск ---------- */
  barTot.textContent = String(N - 1).padStart(2, '0');
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

  // первый кадр: появление из темноты, затем выезд заголовка
  if (!reduce) {
    film.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1400, easing: 'cubic-bezier(.16,1,.3,1)' });
    const t0 = performance.now() + 350;
    (function introStep(now) {
      intro = ease(clamp01((now - t0) / 1900));
      if (intro < 1) requestAnimationFrame(introStep);
    })(t0);
  }

  fontsReady.then(() => {
    stitchHero(!reduce);
    document.querySelectorAll('canvas[data-letter]').forEach((c) => S.drawGrid(c, monogramGrid(c.dataset.letter), C.linen));
    if (hasGsap) ScrollTrigger.refresh();
  });

  if (hasGsap && !reduce) {
    ScrollTrigger.batch('.ground .reveal', {
      start: 'top 88%', once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 })
    });
    const r = { p: 0 };
    drawRushnik(0);
    ScrollTrigger.create({
      trigger: '#rushnik', start: 'top 90%', once: true,
      onEnter: () => gsap.to(r, { p: 1, duration: 2.6, ease: 'power1.inOut', onUpdate: () => drawRushnik(r.p) })
    });
    window.addEventListener('resize', () => drawRushnik(r.p));
  } else {
    drawRushnik(1);
    document.querySelectorAll('.reveal').forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
    window.addEventListener('resize', () => drawRushnik(1));
  }
})();
