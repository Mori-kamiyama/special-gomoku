// A″：A′ をさらに練った爆弾の演出（Claude）。tools/fx-compare.html の定数と関数を使う
// A′ からの主な変更
// - 予兆に「吸い込み」：爆発の直前に爆弾が内へ縮み、まわりの石が少し寄る。直後に外へ飛ぶので、差が大きくなる
// - 平らな閃光：届く範囲が一瞬クリーム色に光る（グラデーションなし）
// - 輪を2本：太い橙の輪と、少し遅れて細い赤の輪
// - 炎：しずく形が揺れ、先から小さなしずくがちぎれて昇る。色は黄 → 橙 → 赤と変わってから縮む
// - 光の筋：本数を減らし、長短を交互に。先に小さな玉が付いて、さらに飛ぶ
// - 割れた石：2つの丸が盤に落ちて、小さく跳ねてから消える（重さを出す。3つで遠くまで飛ばすと騒がしかった）
// - 煙：大きな丸に、明るい小さな丸を重ねる2色の塗り分け。揺れながら昇る
// - 余韻：焦げ跡の上に、小さな残り火が2回またたいて消える
// - 揺れ：最初に大きく、少し傾いてから収まる
(function () {
  const CREAM_FLASH = '#fff3d6';
  const SMOKE_D = '#4a433c', SMOKE_L = '#6b6158';
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));

  // 割れた石のかけら：外へ飛び、盤に落ちて跳ねる（y は「高さ」として別に持つ）
  function shard(c, x0, y0, ux, uy, k, R, col, i) {
    const dist = R * (0.9 + i * 0.35) * expoOut(k * 1.2);
    // 高さ：放物線で上がって落ち、1回小さく跳ねる
    let hgt;
    if (k < 0.55) { const q = k / 0.55; hgt = Math.sin(q * Math.PI) * R * 1.1; }
    else { const q = (k - 0.55) / 0.3; hgt = q < 1 ? Math.sin(q * Math.PI) * R * 0.25 : 0; }
    const x = x0 + ux * dist, y = y0 + uy * dist - hgt;
    const r = R * 0.42 * (k < 0.8 ? 1 : 1 - easeIn((k - 0.8) / 0.2));
    if (r <= 0.3) return;
    // 盤の上の影
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.beginPath(); c.ellipse(x0 + ux * dist, y0 + uy * dist + r * 0.3, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); c.fill();
    stone(c, x, y, r, col, { lw: 1.2 });
  }

  function puff(c, x, y, r) {
    if (r <= 0.3) return;
    c.fillStyle = SMOKE_D; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = SMOKE_L; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2); c.fill();
  }

  window.drawA3 = function drawA3(c, w, h, t) {
    const cell = w / (N + 0.6), ox = (w - cell * (N - 1)) / 2, oy = ox;
    const P = (i, j) => [ox + i * cell, oy + j * cell];
    const R = cell * 0.42;
    const sb = t - T_BOOM;
    const INHALE = 0.12; // 吸い込みの長さ（止めの前）
    const [cx, cy] = P(3, 3);

    // 揺れ：最初に大きく、少し傾いてから収まる
    c.save();
    if (sb > 0 && sb < 0.4) {
      const k = sb / 0.4, a = 8 * Math.pow(1 - k, 2.2);
      c.translate(cx, cy);
      c.rotate(Math.sin(sb * 60) * 0.012 * (1 - k));
      c.translate(-cx + Math.sin(sb * 95) * a, -cy + Math.cos(sb * 70) * a * 0.6);
    }
    drawBoard(c, w, ox, oy, cell);

    // 予兆：届く範囲に、角の丸い点線の枠が行き過ぎてから収まる
    if (t > T_LAND && sb < 0.05) {
      const k = backOut((t - T_LAND) / 0.2);
      const half = cell * 1.5 * clamp(k, 0, 1.1);
      c.fillStyle = 'rgba(229,83,61,0.1)';
      c.strokeStyle = 'rgba(229,83,61,0.5)'; c.lineWidth = 2; c.setLineDash([5, 6]); c.lineDashOffset = -t * 36;
      c.beginPath(); c.roundRect(cx - half, cy - half, half * 2, half * 2, cell * 0.28); c.fill(); c.stroke();
      c.setLineDash([]);
    }
    // 平らな閃光：届く範囲が一瞬クリーム色に
    if (sb >= 0 && sb < 0.07) {
      c.fillStyle = CREAM_FLASH;
      c.beginPath(); c.roundRect(cx - cell * 1.5, cy - cell * 1.5, cell * 3, cell * 3, cell * 0.28); c.fill();
    }
    // 焦げ跡と残り火
    if (sb > 0.06) {
      const k = clamp((sb - 0.06) / 0.22), out = clamp((t - (LOOP - 0.45)) / 0.4);
      const r = cell * 0.9 * backOut(k) * (1 - easeIn(out));
      c.fillStyle = 'rgba(70,45,25,0.18)';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      const g = rng(77);
      for (let i = 0; i < 5; i++) {
        const a = g() * Math.PI * 2, d = cell * (0.2 + g() * 0.5);
        const kk = clamp((sb - 0.55 - i * 0.05) / 0.7);
        if (kk <= 0 || kk >= 1) continue;
        const blink = Math.sin(kk * Math.PI * 4) > -0.3 ? 1 : 0.4; // 2回またたく
        c.fillStyle = i % 2 ? ORANGE : ACC;
        c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cell * 0.05 * blink * (1 - easeIn(kk)), 0, Math.PI * 2); c.fill();
      }
    }

    // 先にある石
    for (const [i, j, col, dies] of PRE) {
      let [x, y] = P(i, j);
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      // 吸い込み：爆発の直前に、少し爆弾へ寄る
      const pre = sb > -INHALE - 0.06 && sb < 0 ? easeIn(clamp((sb + INHALE + 0.06) / INHALE)) : 0;
      if (dies) {
        if (sb <= 0.01) { stone(c, x - ux * cell * 0.08 * pre * (dies ? 1 : 0.4), y - uy * cell * 0.08 * pre, R, col); continue; }
        const k = clamp((sb - 0.01) / 0.75);
        if (k < 0.1) { const q = k / 0.1; stone(c, x + ux * cell * 0.1 * q, y + uy * cell * 0.1 * q, R * lerp(1, 1.15, q), col); continue; }
        const kk = (k - 0.1) / 0.9;
        for (let n = 0; n < 2; n++) {
          const a = Math.atan2(uy, ux) + (n - 0.5) * 0.9;
          shard(c, x, y, Math.cos(a), Math.sin(a), kk, R, col, n);
        }
        continue;
      }
      if (sb < 0) { x -= ux * cell * 0.04 * pre; y -= uy * cell * 0.04 * pre; }
      else {
        const k = clamp(sb / 0.55);
        const push = Math.sin(k * Math.PI * 2.5) * Math.pow(1 - k, 2) * cell * 0.1;
        x += ux * push; y += uy * push;
      }
      stone(c, x, y, R, col);
    }

    // 爆弾の石：落ちる → つぶれて着いて跳ねる → ふくらみながら震える → 吸い込みで縮む
    if (t > T_DROP && sb < -0.0) {
      let y = cy, sx = 1, sy = 1, jit = 0;
      if (t < T_LAND) { const k = easeIn((t - T_DROP) / (T_LAND - T_DROP)); y = lerp(cy - cell * 1.6, cy, k); sy = lerp(1, 1.14, k); sx = lerp(1, 0.9, k); }
      else if (t < T_LAND + 0.14) { const k = (t - T_LAND) / 0.14, sq = Math.sin(k * Math.PI) * (1 - k * 0.4); sx = 1 + 0.24 * sq; sy = 1 - 0.24 * sq; }
      else if (sb < -INHALE - 0.06) { const k = clamp((t - T_LAND - 0.14) / (T_BOOM - INHALE - 0.06 - T_LAND - 0.14)); jit = k * k * 2.2; sx = sy = 1 + easeIn(k) * 0.16; }
      else { const k = clamp((sb + INHALE + 0.06) / INHALE); sx = sy = lerp(1.16, 0.82, easeIn(k)); jit = 1; }
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.beginPath(); c.ellipse(cx, cy + R * 0.3, R * 0.95, R * 0.4, 0, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(cx + (Math.random() - 0.5) * jit, y + (Math.random() - 0.5) * jit); c.scale(sx, sy);
      if (t > T_LAND + 0.14 && sb < -0.06) {
        const k = ((t - T_LAND) * 3.2) % 1;
        c.strokeStyle = `rgba(229,83,61,${1 - k})`; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, R * (1.1 + k * 0.6), 0, Math.PI * 2); c.stroke();
      }
      stone(c, 0, 0, R, 'b'); bombIcon(c, 0, 0, R);
      c.restore();
    }
    if (sb >= -0.06 && sb < 0) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, Math.PI * 2); c.stroke();
    }

    if (sb >= 0) {
      const g = rng(31);
      // 芯：白 → 黄 → 橙と段で変わりながら、行き過ぎてから縮む
      const kc = clamp(sb / 0.24);
      if (kc < 1) {
        const r = R * 1.55 * (kc < 0.2 ? backOut(kc / 0.2) : 1 - easeIn((kc - 0.2) / 0.8));
        c.fillStyle = kc < 0.2 ? '#fff' : kc < 0.5 ? YELLOW : ORANGE;
        c.beginPath(); c.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2); c.fill();
      }
      // 輪2本：太い橙（速い）と、細い赤（遅れて、遠くまで）。途中で弧に割れる
      for (const [col, wid, dl, far, dur] of [[ORANGE, 0.24, 0, 2.1, 0.4], [ACC, 0.08, 0.07, 2.6, 0.55]]) {
        const k = clamp((sb - dl) / dur);
        if (k <= 0 || k >= 1) continue;
        const r = lerp(R * 1.1, cell * far, expoOut(k));
        c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = Math.max(0.5, cell * wid * (1 - k));
        if (k < 0.3) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
        else {
          const gap = lerp(0.04, 0.6, (k - 0.3) / 0.7);
          for (let i = 0; i < 8; i++) { const a0 = (i / 8) * Math.PI * 2 + k * 0.5 + dl * 8; c.beginPath(); c.arc(cx, cy, r, a0 + gap / 2, a0 + Math.PI / 4 - gap / 2); c.stroke(); }
        }
      }
      // 光の筋：長短を交互に。伸びて根元から消え、先の玉はさらに飛ぶ
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8 + (g() - 0.5) * 0.15;
        const long = i % 2 === 0, len = long ? 2.2 : 1.5;
        const k = clamp((sb - (long ? 0 : 0.03)) / 0.32);
        if (k > 0 && k < 1) {
          const head = expoOut(clamp(k / 0.5)), tail = easeIn(clamp((k - 0.15) / 0.85));
          capsule(c, cx, cy, a, R * 1.25, cell * len, tail, head, long ? 4 : 2.5, long ? ACC : ORANGE);
        }
        const kb = clamp((sb - 0.08) / 0.4);
        if (kb > 0 && kb < 1) {
          const d = lerp(cell * len * 0.9, cell * (len + 0.6), expoOut(kb));
          c.fillStyle = long ? ACC : ORANGE;
          c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cell * (long ? 0.075 : 0.055) * (1 - easeIn(kb)), 0, Math.PI * 2); c.fill();
        }
      }
      // 炎：しずく形が揺れる。色は時間で黄 → 橙 → 赤。先から小さなしずくがちぎれて昇る
      const flames = [[-0.5, 0.95, 0], [0, 1.3, 0.02], [0.5, 1.0, 0.01], [-0.9, 0.6, 0.04], [0.9, 0.65, 0.03]];
      const layerCols = [[ACC, ACC, ACC], [ORANGE, ORANGE, ACC], [YELLOW, ORANGE, ORANGE]];
      const sizes = [1, 0.7, 0.42];
      for (let L = 0; L < 3; L++) {
        for (const [ang, hh, dl0] of flames) {
          const k = clamp((sb - 0.03 - L * 0.035 - dl0) / 0.6);
          if (k <= 0 || k >= 1) continue;
          const grow = k < 0.3 ? backOut(k / 0.3) : 1 - easeIn((k - 0.3) / 0.7);
          const f = sizes[L], r = cell * 0.34 * f * grow, hgt = cell * 0.78 * hh * f * grow + r;
          const sway = Math.sin(sb * 22 + ang * 3) * 0.08;
          c.fillStyle = layerCols[L][Math.min(2, Math.floor(k * 3))];
          drop(c, cx + Math.sin(ang) * cell * 0.25 * f, cy - cell * 0.12 * k, r, hgt, ang * 0.55 + sway);
        }
      }
      for (let i = 0; i < 4; i++) {
        const k = clamp((sb - 0.18 - i * 0.06) / 0.4);
        if (k <= 0 || k >= 1) continue;
        const x = cx + (i - 1.5) * cell * 0.22 + Math.sin(k * 8 + i) * cell * 0.05;
        const y = cy - cell * (0.7 + 0.8 * easeOut(k));
        c.fillStyle = i % 2 ? ORANGE : YELLOW;
        drop(c, x, y, cell * 0.07 * (1 - k), cell * 0.18 * (1 - k), 0);
      }
      // 煙：2色の丸。揺れながら昇り、縮んで消える
      for (let i = 0; i < 6; i++) {
        const k = clamp((sb - 0.18 - i * 0.035) / 1.0);
        if (k <= 0 || k >= 1) continue;
        const a = -Math.PI / 2 + (i - 2.5) * 0.48;
        const wob = Math.sin(k * 6 + i) * cell * 0.05;
        const x = cx + Math.cos(a) * cell * 0.5 * easeOut(k) + wob;
        const y = cy + Math.sin(a) * cell * 0.3 * easeOut(k) - cell * 0.8 * easeOut(k);
        const r = cell * (0.3 + (i % 2) * 0.08) * (k < 0.22 ? backOut(k / 0.22) : 1 - easeIn((k - 0.22) / 0.78));
        puff(c, x, y, r);
      }
    }
    c.restore();
  };
  const note = document.getElementById('note-a3');
  if (note) note.textContent = '吸い込みの予兆、平らな閃光、2本の輪、ちぎれて昇る炎、先に玉の付いた光の筋、盤に落ちて跳ねるかけら、2色の煙、またたく残り火。';
})();
