window.drawCodex = function (c, w, h, t) {
    const cell = w / (N + 0.6), ox = (w - cell * (N - 1)) / 2, oy = ox;
    const P = (i, j) => [ox + i * cell, oy + j * cell];
    const R = cell * 0.42;
    const sb = t - T_BOOM;
    const [cx, cy] = P(3, 3);
    const rand = rng(37);

    // 同じ時刻では同じ位置に戻るよう、揺れも時刻から計算する
    let sx = 0, sy = 0;
    if (sb > 0 && sb < 0.28) {
        const amp = 4.5 * Math.pow(1 - sb / 0.28, 2);
        sx = Math.sin(sb * 88) * amp;
        sy = Math.cos(sb * 73) * amp * 0.55;
    }
    c.save();
    c.translate(sx, sy);
    drawBoard(c, w, ox, oy, cell);

    // 予兆：範囲の枠を静かに脈打たせ、爆発直前に内側へ締める
    if (t > T_LAND && sb < 0.04) {
        const charge = clamp((t - T_LAND) / (T_BOOM - T_LAND));
        const pulse = 1 + Math.sin((t - T_LAND) * 28) * 0.025;
        const half = cell * 1.5 * pulse * (1 - charge * 0.06);
        c.fillStyle = 'rgba(229,83,61,0.09)';
        c.strokeStyle = ACC;
        c.lineWidth = 2;
        c.setLineDash([7, 6]);
        c.lineDashOffset = -t * 32;
        c.beginPath();
        c.roundRect(cx - half, cy - half, half * 2, half * 2, cell * 0.23);
        c.fill();
        c.stroke();
        c.setLineDash([]);
    }

    // 焦げ跡は爆発のあとに広がってから小さく収める
    if (sb > 0.08 && t < LOOP - 0.2) {
        const out = clamp((sb - 0.08) / 0.24);
        const fade = clamp((t - (LOOP - 0.48)) / 0.38);
        c.fillStyle = 'rgba(70,45,25,0.15)';
        c.beginPath();
        c.arc(cx, cy, cell * 0.88 * backOut(out) * (1 - easeIn(fade)), 0, Math.PI * 2);
        c.fill();
    }

    // 先に置かれた石は、近いものほど少し遅れて丸くほどける
    for (const [i, j, col, dies] of PRE) {
        let [x, y] = P(i, j);
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        if (sb > 0 && dies) {
            const delay = d < cell * 1.2 ? 0.035 : 0;
            const k = clamp((sb - delay) / 0.43);
            if (k < 0.2) {
                const swell = easeOut(k / 0.2);
                stone(c, x + ux * cell * 0.12 * swell, y + uy * cell * 0.12 * swell, R * (1 + 0.12 * swell), col);
            } else {
                const kk = (k - 0.2) / 0.8;
                for (let n = 0; n < 3; n++) {
                    const a = Math.atan2(uy, ux) + (n - 1) * 0.82;
                    const dist = cell * (0.12 + 0.48 * easeOut(kk));
                    stone(c, x + Math.cos(a) * dist, y + Math.sin(a) * dist, R * 0.42 * (1 - easeIn(kk)), col, { lw: 1.2 });
                }
            }
            continue;
        }
        if (sb > 0 && !dies) {
            const k = clamp(sb / 0.48);
            const push = Math.sin(k * Math.PI * 2.2) * Math.pow(1 - k, 2) * cell * 0.075;
            x += ux * push;
            y += uy * push;
        }
        stone(c, x, y, R, col);
    }

    // 爆弾は落下、着地の弾み、短い溜めを経て爆発する
    if (t > T_DROP && sb < 0) {
        let y = cy, sxk = 1, syk = 1;
        if (t < T_LAND) {
            const k = easeIn((t - T_DROP) / (T_LAND - T_DROP));
            y = lerp(cy - cell * 1.6, cy, k);
            sxk = lerp(1, 0.93, k);
            syk = lerp(1, 1.1, k);
        } else if (t < T_LAND + 0.12) {
            const k = (t - T_LAND) / 0.12;
            const bounce = Math.sin(k * Math.PI) * (1 - k * 0.35);
            sxk = 1 + bounce * 0.18;
            syk = 1 - bounce * 0.18;
        } else {
            const k = clamp((t - T_LAND - 0.12) / (T_BOOM - T_LAND - 0.12));
            const pulse = Math.sin(k * Math.PI * 5) * k;
            sxk = 1 + k * 0.12 + pulse * 0.025;
            syk = 1 + k * 0.12 - pulse * 0.025;
        }
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.beginPath();
        c.ellipse(cx, cy + R * 0.3, R * 0.9, R * 0.38, 0, 0, Math.PI * 2);
        c.fill();
        c.save();
        c.translate(cx, y);
        c.scale(sxk, syk);
        if (t > T_LAND + 0.12) {
            const k = ((t - T_LAND - 0.12) * 2.6) % 1;
            c.strokeStyle = `rgba(229,83,61,${1 - k})`;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, 0, R * (1.12 + k * 0.55), 0, Math.PI * 2);
            c.stroke();
        }
        stone(c, 0, 0, R, 'b');
        bombIcon(c, 0, 0, R);
        c.restore();
    }

    // 爆発の一瞬だけ白い円で止め、次のフレームで色の波へつなぐ
    if (sb >= -0.06 && sb < 0) {
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(cx, cy, R * 1.28, 0, Math.PI * 2);
        c.fill();
    }

    if (sb >= 0) {
        // 熱の芯を縮め、外側の橙色の輪を大きく広げる
        const core = clamp(sb / 0.19);
        if (core < 1) {
            c.fillStyle = core < 0.22 ? '#fff' : core < 0.58 ? YELLOW : ORANGE;
            c.beginPath();
            c.arc(cx, cy, R * 1.32 * (1 - easeIn(core)), 0, Math.PI * 2);
            c.fill();
        }
        const wave = clamp(sb / 0.4);
        if (wave < 1) {
            const radius = lerp(R * 1.05, cell * 2.08, easeOut(wave));
            c.strokeStyle = ORANGE;
            c.lineCap = 'round';
            c.lineWidth = Math.max(1, cell * 0.24 * (1 - wave));
            if (wave < 0.42) {
                c.beginPath();
                c.arc(cx, cy, radius, 0, Math.PI * 2);
                c.stroke();
            } else {
                const gap = lerp(0.12, 0.48, (wave - 0.42) / 0.58);
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 + wave * 0.32;
                    c.beginPath();
                    c.arc(cx, cy, radius, a + gap / 2, a + Math.PI / 3 - gap / 2);
                    c.stroke();
                }
            }
        }

        // 炎は少数の太いしずく形にして、黄・橙・赤の順に少し遅らせる
        const tongues = [[-0.62, 0.76], [-0.18, 1.05], [0.3, 0.92], [0.72, 0.66], [1.55, 0.58]];
        const layers = [[ACC, 1, 0.045], [ORANGE, 0.72, 0.075], [YELLOW, 0.43, 0.105]];
        for (const [color, scale, delay] of layers) {
            c.fillStyle = color;
            for (const [angle, height] of tongues) {
                const k = clamp((sb - delay) / 0.49);
                if (k <= 0 || k >= 1) continue;
                const grow = k < 0.32 ? backOut(k / 0.32) : 1 - easeIn((k - 0.32) / 0.68);
                const r = cell * 0.3 * scale * grow;
                const hgt = cell * height * scale * grow + r;
                drop(c, cx + Math.sin(angle) * cell * 0.19 * scale, cy - cell * 0.03 * k, r, hgt, angle * 0.42);
            }
        }

        // 小さな丸は数を絞り、外周へ抜ける動きを見せる
        for (let i = 0; i < 7; i++) {
            const angle = rand() * Math.PI * 2;
            const speed = cell * (1.25 + rand() * 0.75);
            const delay = (i % 3) * 0.035;
            const k = clamp((sb - delay) / 0.48);
            if (k <= 0 || k >= 1) continue;
            const dist = speed * easeOut(k);
            c.fillStyle = i % 3 === 0 ? INK : i % 3 === 1 ? ACC : ORANGE;
            c.beginPath();
            c.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist + cell * 0.2 * k * k, cell * (0.085 - k * 0.045), 0, Math.PI * 2);
            c.fill();
        }

        // 炎のあとに煙がまとまりで上がり、縮んで消える
        for (let i = 0; i < 5; i++) {
            const k = clamp((sb - 0.19 - i * 0.045) / 0.85);
            if (k <= 0 || k >= 1) continue;
            const angle = -Math.PI / 2 + (i - 2) * 0.48;
            const dist = cell * 0.42 * easeOut(k);
            const radius = cell * (0.3 + (i % 2) * 0.05) * (k < 0.25 ? backOut(k / 0.25) : 1 - easeIn((k - 0.25) / 0.75));
            c.fillStyle = i % 2 ? '#5d554c' : '#4a433c';
            c.beginPath();
            c.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist - cell * 0.6 * easeOut(k), radius, 0, Math.PI * 2);
            c.fill();
        }
    }

    c.restore();
};

const note = document.getElementById('note-c');
if (note) note.textContent = '爆発の輪郭を整理し、圧縮する芯から大きな波紋、遅れて立ち上がる炎と煙へ視線が流れるようにしました。石の反応と粒も少し絞り、同じ時刻で同じ絵になる動きにしています。';
