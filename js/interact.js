/* ==========================================================
   Интерактив: истории героинь, вопросы бабушке,
   редактор вышивки, стена памяти
   ========================================================== */
(function () {
  'use strict';
  const S = window.Stitch;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!window.gsap;
  const refresh = () => window.__rebuildThread && window.__rebuildThread();

  /* ---------- Героини: раскрывающиеся истории ---------- */
  document.querySelectorAll('.heroine-btn').forEach((btn) => {
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      if (hasGsap && !reduce) {
        gsap.to(body, {
          height: open ? 'auto' : 0, duration: 0.6, ease: 'power3.inOut', onComplete: refresh
        });
        if (open) gsap.from(body.querySelectorAll('p'), { opacity: 0, y: 14, duration: 0.6, stagger: 0.08, delay: 0.15 });
      } else {
        body.style.height = open ? 'auto' : '0';
        refresh();
      }
    });
  });

  /* ---------- Вопросы бабушке ---------- */
  const QUESTIONS = [
    'Где ты была, когда узнала о Победе? Что ты тогда почувствовала?',
    'Как звали твоих родителей и что ты помнишь о них?',
    'Какую песню пели у вас дома, когда собиралась вся семья?',
    'Кто в нашей семье воевал или был в партизанах? Что о них рассказывали?',
    'Каким было твоё детство? Во что вы играли?',
    'Есть ли у нас дома вещь, которая осталась с военных лет?',
    'Кто научил тебя вышивать, печь хлеб или чинить одежду?',
    'Какой день ты считаешь самым счастливым в своей жизни?',
    'Что бы ты хотела, чтобы я обязательно запомнил(а) и передал(а) своим детям?',
    'Как выглядела наша деревня или улица, когда ты была молодой?'
  ];
  const deck = document.getElementById('deck');
  let qi = 0;
  function makeCard(i) {
    const card = document.createElement('div');
    card.className = 'card';
    const q = document.createElement('p');
    q.className = 'card-q';
    q.textContent = QUESTIONS[i % QUESTIONS.length];
    const n = document.createElement('span');
    n.className = 'card-n';
    n.textContent = `Вопрос ${(i % QUESTIONS.length) + 1} из ${QUESTIONS.length}`;
    card.append(q, n);
    return card;
  }
  function layoutDeck() {
    const cards = Array.from(deck.children);
    cards.forEach((c, k) => {
      const depth = cards.length - 1 - k; // 0 — верхняя
      const t = `translate(${depth * 10}px, ${depth * 12}px) rotate(${depth * 1.6}deg)`;
      if (hasGsap && !reduce) gsap.to(c, { transform: t, duration: 0.5, ease: 'power2.out' });
      else c.style.transform = t;
      c.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
    });
  }
  for (let k = 2; k >= 0; k--) deck.appendChild(makeCard(k));
  layoutDeck();
  document.getElementById('deckNext').addEventListener('click', () => {
    const top = deck.lastElementChild;
    qi++;
    const next = makeCard(qi + 2);
    const finish = () => { top.remove(); deck.prepend(next); layoutDeck(); };
    if (hasGsap && !reduce) {
      gsap.to(top, { x: 360, y: -40, rotation: 14, opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: finish });
    } else finish();
  });
  document.getElementById('deckCopy').addEventListener('click', (e) => {
    const text = deck.lastElementChild.querySelector('.card-q').textContent;
    const btn = e.currentTarget;
    const done = () => { btn.textContent = 'Скопировано'; setTimeout(() => (btn.textContent = 'Скопировать вопрос'), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
  });

  /* ---------- Редактор вышивки ---------- */
  const N = 25;
  const studio = document.getElementById('studio');
  let grid = Array.from({ length: N }, () => Array(N).fill(null));
  let color = '#a8142a';
  let mirror = true;

  function stampMotif(name, col) {
    const m = S.patternToGrid(name);
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    // рамка
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) { grid[0][i] = grid[N - 1][i] = grid[i][0] = grid[i][N - 1] = '#22262b'; }
    }
    for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (m[y][x]) grid[y + 5][x + 5] = col;
  }

  function cellSize() { return studio.clientWidth / N; }
  function drawStudio(animateList) {
    const w = studio.clientWidth;
    const ctx = S.fit(studio, w, w);
    const s = w / N;
    ctx.fillStyle = '#f1efe8';
    ctx.fillRect(0, 0, w, w);
    // дырочки канвы
    ctx.fillStyle = 'rgba(34, 38, 43, 0.13)';
    for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) { ctx.fillRect(x * s - 0.75, y * s - 0.75, 1.5, 1.5); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (grid[y][x] && !(animateList && animateList.has(y * N + x))) S.cross(ctx, x * s, y * s, s, grid[y][x]);
    }
    return { ctx, s };
  }

  // анимация вышивания выбранного знака
  function stitchIn() {
    if (reduce) { drawStudio(); return; }
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y][x]) cells.push({ x, y, c: grid[y][x], k: y + Math.random() * 2 });
    cells.sort((a, b) => a.k - b.k);
    const pending = new Set(cells.map((c) => c.y * N + c.x));
    const { ctx, s } = drawStudio(pending);
    let i = 0;
    const per = Math.max(2, Math.ceil(cells.length / 50));
    (function step() {
      for (let k = 0; k < per && i < cells.length; k++, i++) S.cross(ctx, cells[i].x * s, cells[i].y * s, s, cells[i].c);
      if (i < cells.length) requestAnimationFrame(step);
    })();
  }

  function cellAt(evt) {
    const r = studio.getBoundingClientRect();
    return [Math.floor(((evt.clientX - r.left) / r.width) * N), Math.floor(((evt.clientY - r.top) / r.height) * N)];
  }
  function stitchCell(x, y) {
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    const v = color === 'erase' ? null : color;
    const pts = mirror ? [[x, y], [N - 1 - x, y], [x, N - 1 - y], [N - 1 - x, N - 1 - y]] : [[x, y]];
    let changed = false;
    pts.forEach(([px, py]) => { if (grid[py][px] !== v) { grid[py][px] = v; changed = true; } });
    return changed;
  }
  let painting = false, last = null;
  function paintTo(evt) {
    const [x, y] = cellAt(evt);
    let changed = false;
    if (last) {
      // заполняем промежуток между событиями мыши, чтобы линия была без дырок
      const steps = Math.max(Math.abs(x - last[0]), Math.abs(y - last[1]));
      for (let i = 1; i <= steps; i++) {
        changed = stitchCell(Math.round(last[0] + ((x - last[0]) * i) / steps), Math.round(last[1] + ((y - last[1]) * i) / steps)) || changed;
      }
    } else changed = stitchCell(x, y);
    last = [x, y];
    if (changed) drawStudio();
  }
  studio.addEventListener('pointerdown', (e) => { painting = true; last = null; studio.setPointerCapture(e.pointerId); paintTo(e); });
  studio.addEventListener('pointermove', (e) => { if (painting) paintTo(e); });
  ['pointerup', 'pointercancel'].forEach((t) => studio.addEventListener(t, () => { painting = false; last = null; }));

  const meaning = document.getElementById('motifMeaning');
  document.querySelectorAll('#motifs .motif-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#motifs .motif-btn').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      stampMotif(b.dataset.motif, color === 'erase' ? '#a8142a' : color);
      meaning.textContent = S.MEANINGS[b.dataset.motif];
      stitchIn();
    });
  });
  document.querySelectorAll('#colors .swatch').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#colors .swatch').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      color = b.dataset.color;
    });
  });
  const mirrorBtn = document.getElementById('mirrorBtn');
  mirrorBtn.addEventListener('click', () => { mirror = !mirror; mirrorBtn.setAttribute('aria-pressed', String(mirror)); });
  document.getElementById('clearBtn').addEventListener('click', () => {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    document.querySelectorAll('#motifs .motif-btn').forEach((o) => o.setAttribute('aria-pressed', 'false'));
    meaning.textContent = 'Канва чистая. Вышивайте сами или выберите знак.';
    drawStudio();
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    const out = document.createElement('canvas');
    const s = 32, pad = 48;
    out.width = out.height = N * s + pad * 2;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#efede6';
    ctx.fillRect(0, 0, out.width, out.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y][x]) S.cross(ctx, pad + x * s, pad + y * s, s, grid[y][x]);
    ctx.fillStyle = '#4d5157';
    ctx.font = '500 20px Golos, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Связь поколений: мы помним', out.width / 2, out.height - 14);
    const a = document.createElement('a');
    a.download = 'moy-znak-pamyati.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });

  stampMotif('bereginya', '#a8142a');
  meaning.textContent = S.MEANINGS.bereginya;
  document.querySelector('#motifs [data-motif="bereginya"]').setAttribute('aria-pressed', 'true');
  drawStudio();
  let sw = studio.clientWidth;
  window.addEventListener('resize', () => { if (studio.clientWidth !== sw) { sw = studio.clientWidth; drawStudio(); } });
  // первый показ — вышиваем, когда редактор появился на экране
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting) { stitchIn(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(studio);
  }

  /* ---------- Стена памяти ---------- */
  const KEY = 'svyaz-pokoleniy-wall';
  const BASE = [
    { name: 'Вера Хоружая', note: 'подпольщица, Витебск' },
    { name: 'Татьяна Мариненко', note: 'разведчица отряда «Неуловимые»' },
    { name: 'Зинаида Портнова', note: '«Юные мстители», Оболь' },
    { name: 'Ефросинья Зенькова', note: 'руководитель «Юных мстителей»' },
    { name: 'Елена Мазаник', note: 'Минское подполье' },
    { name: 'Мария Осипова', note: 'Минское подполье' },
    { name: 'Надежда Троян', note: 'партизанская разведчица' }
  ];
  const wall = document.getElementById('wall');
  const msg = document.getElementById('wallNoteMsg');
  let memory = null; // запасной вариант, если браузер не даёт сохранять
  function load() { if (memory) return memory.slice(); try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); memory = null; return true; } catch (e) { memory = list.slice(); return false; } }
  function render(highlightLast) {
    wall.innerHTML = '';
    const mine = load();
    mine.slice().reverse().forEach((item, ri) => {
      const idx = mine.length - 1 - ri;
      const li = document.createElement('li');
      li.className = 'tag tag--mine';
      const b = document.createElement('b'); b.textContent = item.name;
      const sp = document.createElement('span'); sp.textContent = item.note || 'Помним';
      const del = document.createElement('button');
      del.className = 'tag-del'; del.type = 'button'; del.textContent = '×';
      del.setAttribute('aria-label', 'Убрать имя ' + item.name);
      del.addEventListener('click', () => { const l = load(); l.splice(idx, 1); save(l); render(); refresh(); });
      li.append(b, sp, del);
      wall.appendChild(li);
      if (highlightLast && ri === 0 && hasGsap && !reduce) gsap.from(li, { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' });
    });
    BASE.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'tag';
      const b = document.createElement('b'); b.textContent = item.name;
      const sp = document.createElement('span'); sp.textContent = item.note;
      li.append(b, sp);
      wall.appendChild(li);
    });
  }
  document.getElementById('wallForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('wallName').value.trim();
    const note = document.getElementById('wallNote').value.trim();
    if (name.length < 2) { msg.textContent = 'Впишите имя — хотя бы две буквы.'; document.getElementById('wallName').focus(); return; }
    const list = load();
    list.push({ name, note });
    const ok = save(list);
    msg.textContent = ok ? `Имя «${name}» вышито на стене памяти.` : 'Браузер не разрешает сохранять данные: имя видно только до перезагрузки страницы.';
    e.target.reset();
    render(true);
    refresh();
  });
  render();
})();
