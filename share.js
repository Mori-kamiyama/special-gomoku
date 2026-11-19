// 棋譜のシェア：対局の結果を1枚の画像（1080×1350、SNS で見やすい縦長）にして、共有・保存する。
// 画像には、結果・2人の名前とデッキ・最後の盤（揃った列を光らせる）・最後の手・使われた超能力・手数・URL を載せる。
(function () {
  const W = 1080, H = 1350;
  const C = { bg: '#f7f4ee', ink: '#1f1d1a', muted: '#8b857b', board: '#efd6a3', line: '#8a6a3a', accent: '#e5533d', win: '#f5c518', card: '#ebe6dc', neutral: '#a8a296' };
  const URL_TEXT = 'new-umechan.github.io/special-gomoku';
  const $ = (id) => document.getElementById(id);

  // 碁石のアイコン（SVG）を画像にする。色を指定して、同じものは使い回す
  const iconCache = {};
  function iconImage(id, color) {
    const key = `${id}|${color}`;
    if (iconCache[key]) return iconCache[key];
    const body = (ICONS[id] || '').replace(/currentColor/g, color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    iconCache[key] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    return iconCache[key];
  }

  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function fitText(c, text, max) {
    let t = text;
    while (c.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + '…';
    return t;
  }

  async function stone(c, x, y, r, p) {
    const color = p.color === 'b' ? C.ink : p.color === 'w' ? '#ffffff' : C.neutral;
    c.fillStyle = color;
    if (p.color === 'n') { roundRect(c, x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5, r * 0.35); c.fill(); return; }
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    if (p.color === 'w') { c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke(); }
    if (p.ability && p.ability !== 'plain' && ICONS[p.ability]) {
      const img = await iconImage(p.ability, p.color === 'b' ? '#ffffff' : C.ink);
      if (img) c.drawImage(img, x - r * 0.62, y - r * 0.62, r * 1.24, r * 1.24);
    }
  }

  async function makeImage() {
    try { await document.fonts.load('700 40px "Zen Maru Gothic"'); await document.fonts.load('80px "Dela Gothic One"'); } catch (e) { /* 字が読めなくても続ける */ }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const body = '"Zen Maru Gothic", system-ui, sans-serif';
    const display = '"Dela Gothic One", "Zen Maru Gothic", sans-serif';
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);

    // 見出し：ゲームの名前と、結果
    c.fillStyle = C.ink; c.textBaseline = 'alphabetic';
    c.font = `44px ${display}`; c.fillText('超能力五目並べ', 64, 104);
    c.font = `76px ${display}`;
    c.fillStyle = state.winner ? C.accent : C.ink;
    c.fillText(fitText(c, state.resultText || '対局', W - 128), 64, 200);
    c.fillStyle = C.muted; c.font = `700 30px ${body}`;
    const sub = state.resultSub || '';
    c.fillText(fitText(c, /手目/.test(sub) ? sub : `${sub}　${state.moveCount}手`, W - 128), 64, 252);

    // 2人：名前とデッキ
    const players = ['b', 'w'].map((col) => ({ col, name: playerName(col), deck: (state.deckNames && state.deckNames[col]) || '' }));
    players.forEach((pl, i) => {
      const x = 64 + i * 484, y = 290;
      c.fillStyle = C.card; roundRect(c, x, y, 468, 104, 24); c.fill();
      if (state.winner === pl.col) { c.lineWidth = 5; c.strokeStyle = C.accent; roundRect(c, x + 2.5, y + 2.5, 463, 99, 22); c.stroke(); }
      c.beginPath(); c.arc(x + 52, y + 52, 26, 0, Math.PI * 2);
      c.fillStyle = pl.col === 'b' ? C.ink : '#ffffff'; c.fill();
      if (pl.col === 'w') { c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke(); }
      c.fillStyle = C.ink; c.font = `700 34px ${body}`; c.fillText(fitText(c, pl.name, 360), x + 96, y + 50);
      c.fillStyle = C.muted; c.font = `700 24px ${body}`; c.fillText(fitText(c, pl.deck, 360), x + 96, y + 84);
    });

    // 盤：最後の形。揃った列は黄色、最後の手は赤い輪
    const bs = 720, bx = (W - bs) / 2, by = 424, pad = 30, cell = (bs - pad * 2) / (SIZE - 1);
    c.fillStyle = C.board; roundRect(c, bx, by, bs, bs, 18); c.fill();
    c.strokeStyle = C.line; c.lineWidth = 2;
    for (let k = 0; k < SIZE; k++) {
      c.beginPath(); c.moveTo(bx + pad, by + pad + k * cell); c.lineTo(bx + pad + (SIZE - 1) * cell, by + pad + k * cell); c.stroke();
      c.beginPath(); c.moveTo(bx + pad + k * cell, by + pad); c.lineTo(bx + pad + k * cell, by + pad + (SIZE - 1) * cell); c.stroke();
    }
    c.fillStyle = C.line;
    for (const [sx, sy] of [[5, 5], [2, 2], [8, 2], [2, 8], [8, 8]]) { c.beginPath(); c.arc(bx + pad + sx * cell, by + pad + sy * cell, 5, 0, Math.PI * 2); c.fill(); }
    const win = new Set((state.winLine || []).map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const p = state.board[y][x];
      if (!p) continue;
      const px = bx + pad + x * cell, py = by + pad + y * cell;
      if (win.has(`${x},${y}`)) { c.fillStyle = C.win; c.beginPath(); c.arc(px, py, cell * 0.5, 0, Math.PI * 2); c.fill(); }
      await stone(c, px, py, cell * 0.4, p);
    }
    if (state.lastMove) {
      const [lx, ly] = state.lastMove;
      c.strokeStyle = C.accent; c.lineWidth = 5;
      c.beginPath(); c.arc(bx + pad + lx * cell, by + pad + ly * cell, cell * 0.48, 0, Math.PI * 2); c.stroke();
    }

    // 使われた超能力（多い順に8つまで）
    const used = {};
    for (const h of state.history || []) if (h.id !== 'plain') used[h.id] = (used[h.id] || 0) + 1;
    const top = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const uy = by + bs + 44;
    c.fillStyle = C.muted; c.font = `700 24px ${body}`;
    c.fillText(top.length ? '使われた超能力' : '超能力は使われなかった', 64, uy + 6);
    let ux = 64;
    for (const [id, n] of top) {
      await stone(c, ux + 26, uy + 52, 26, { color: 'b', ability: id });
      c.fillStyle = C.ink; c.font = `700 20px ${body}`;
      c.fillText(`×${n}`, ux + 58, uy + 62);
      ux += 118;
    }

    // いちばん下：URL
    c.fillStyle = C.muted; c.font = `700 24px ${body}`;
    c.textAlign = 'right'; c.fillText(URL_TEXT, W - 64, H - 40); c.textAlign = 'left';
    return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  }

  let blob = null, url = null;
  async function openShare() {
    $('share-btn').disabled = true;
    try {
      blob = await makeImage();
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      $('share-img').src = url;
      // 端末の「共有」が画像を受け取れるときだけ、共有のボタンを出す
      const file = new File([blob], 'special-gomoku.png', { type: 'image/png' });
      $('share-go').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
      $('result-dialog').close();
      $('share-dialog').showModal();
    } finally {
      $('share-btn').disabled = false;
    }
  }
  function save() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `special-gomoku-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function share() {
    if (!blob) return;
    const file = new File([blob], 'special-gomoku.png', { type: 'image/png' });
    const text = `${state.resultText}（${state.moveCount}手）#超能力五目並べ`;
    try { await navigator.share({ files: [file], text, url: `https://${URL_TEXT}/` }); } catch (e) { /* やめたときは何もしない */ }
  }

  function init() {
    if (!$('share-btn')) return;
    $('share-btn').addEventListener('click', openShare);
    $('share-save').addEventListener('click', save);
    $('share-go').addEventListener('click', share);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.ShareImage = { make: makeImage };
})();
