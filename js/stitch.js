/* ==========================================================
   Stitch — маленький движок «вышивки крестиком» на canvas.
   Любая картинка здесь — это сетка клеток (как пиксели),
   а каждая клетка вышивается двумя стежками: «/» и «\».
   ========================================================== */
(function () {
  'use strict';

  // Узоры 15×15. «X» — стежок, «.» — пустая клетка.
  const PATTERNS = {
    // Берегиня — женская фигура с поднятыми руками, оберег дома и рода
    bereginya: [
      '...............',
      '..X.........X..',
      '..X...XXX...X..',
      '...X..XXX..X...',
      '....X..X..X....',
      '.....XXXXX.....',
      '.......X.......',
      '......XXX......',
      '.....XXXXX.....',
      '....XXXXXXX....',
      '...XXXXXXXXX...',
      '.....X...X.....',
      '.....X...X.....',
      '....XX...XX....',
      '...............'
    ],
    // Древо рода — связь предков и потомков
    tree: [
      '.......X.......',
      '......XXX......',
      '...X...X...X...',
      '..XXX..X..XXX..',
      '...X...X...X...',
      '....X..X..X....',
      '.X...X.X.X...X.',
      'XXX...XXX...XXX',
      '.X.X...X...X.X.',
      '....X..X..X....',
      '.....X.X.X.....',
      '......XXX......',
      '.......X.......',
      '.....XXXXX.....',
      '...XXXXXXXXX...'
    ]
  };

  // Ружа — восьмиконечная звезда, знак солнца и жизни (строим математически)
  PATTERNS.ruzha = (function () {
    const rows = [];
    const inShape = (x, y) => Math.abs(x) + Math.abs(y) <= 7 || Math.max(Math.abs(x), Math.abs(y)) <= 4;
    for (let y = -7; y <= 7; y++) {
      let row = '';
      for (let x = -7; x <= 7; x++) {
        const s = Math.abs(x) + Math.abs(y);
        const edge = inShape(x, y) && (!inShape(x + 1, y) || !inShape(x - 1, y) || !inShape(x, y + 1) || !inShape(x, y - 1));
        const inner = s === 3 || s === 0 || (Math.abs(x) === Math.abs(y) && Math.abs(x) === 3);
        row += edge || inner ? 'X' : '.';
      }
      rows.push(row);
    }
    return rows;
  })();

  const MEANINGS = {
    bereginya: 'Берегиня — женская фигура с поднятыми к небу руками. Оберег дома, матери и всего рода. Её вышивали на рушниках, которые дарили на свадьбу.',
    tree: 'Древо рода соединяет корни и ветви: тех, кто был до нас, и тех, кто будет после. Это знак связи поколений.',
    ruzha: 'Ружа — восьмиконечная звезда, древний знак солнца, света и жизни. Один из самых частых узоров белорусского рушника.'
  };

  function patternToGrid(name) {
    return PATTERNS[name].map((r) => Array.from(r.padEnd(15, '.')).map((c) => c === 'X'));
  }

  // Текст → сетка клеток: рисуем буквы на маленьком холсте и читаем пиксели
  function textToGrid(text, rows, font) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const fontPx = rows * 1.25;
    ctx.font = font.replace('{px}', fontPx + 'px');
    const w = Math.ceil(ctx.measureText(text).width) + 2;
    c.width = w; c.height = rows;
    ctx.font = font.replace('{px}', fontPx + 'px');
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 1, rows * 0.94);
    const data = ctx.getImageData(0, 0, w, rows).data;
    const grid = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < w; x++) row.push(data[(y * w + x) * 4 + 3] > 110);
      grid.push(row);
    }
    // обрезаем пустые столбцы по краям
    let l = 0, r = w - 1;
    const colEmpty = (x) => grid.every((row) => !row[x]);
    while (l < r && colEmpty(l)) l++;
    while (r > l && colEmpty(r)) r--;
    return grid.map((row) => row.slice(l, r + 1));
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Один полустежок: диагональ с тенью и бликом, как у настоящей нитки
  function halfStitch(ctx, x, y, s, color, dir, t) {
    if (t <= 0) return;
    const pad = s * 0.16;
    let x0, y0, x1, y1;
    if (dir === 0) { x0 = x + pad; y0 = y + s - pad; x1 = x + s - pad; y1 = y + pad; } // «/»
    else { x0 = x + pad; y0 = y + pad; x1 = x + s - pad; y1 = y + s - pad; }          // «\»
    const ex = x0 + (x1 - x0) * t, ey = y0 + (y1 - y0) * t;
    const lw = Math.max(1, s * 0.26);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x0 + lw * 0.18, y0 + lw * 0.25); ctx.lineTo(ex + lw * 0.18, ey + lw * 0.25); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
    if (s >= 7) {
      ctx.strokeStyle = shade(color, 46);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(0.6, lw * 0.22);
      ctx.beginPath(); ctx.moveTo(x0 + lw * 0.12, y0 - lw * 0.12); ctx.lineTo(ex + lw * 0.12, ey - lw * 0.12); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function cross(ctx, x, y, s, color, t1 = 1, t2 = 1) {
    halfStitch(ctx, x, y, s, color, 0, t1);
    halfStitch(ctx, x, y, s, color, 1, t2);
  }

  // Подготовка холста под плотность экрана
  function fit(canvas, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // Нарисовать сетку целиком (статично)
  function drawGrid(canvas, grid, color, opts = {}) {
    const ctx = canvas.getContext('2d');
    const rows = grid.length, cols = grid[0].length;
    const s = Math.min(canvas.width / cols, canvas.height / rows);
    const ox = (canvas.width - s * cols) / 2, oy = (canvas.height - s * rows) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = grid[y][x];
      if (v) cross(ctx, ox + x * s, oy + y * s, s, typeof v === 'string' ? v : color);
    }
    if (opts.after) opts.after(ctx);
  }

  window.Stitch = { PATTERNS, MEANINGS, patternToGrid, textToGrid, cross, halfStitch, fit, drawGrid, shade };
})();
