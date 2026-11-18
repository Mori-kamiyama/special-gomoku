// 効果音。音のファイルは使わず、Web Audio で毎回つくる。
// 安っぽくならないように：音量は小さく、短く、角の立つ波形（矩形波など）は使わない。
// 置く音は木の碁石の「パチッ」に寄せ、毎回ほんの少し高さを揺らして機械っぽさを消す。
(function () {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;
  try { muted = localStorage.getItem('gomoku-muted') === '1'; } catch (e) { /* 保存できない環境では毎回オン */ }

  function audio() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      // 1秒ぶんの雑音を1回だけつくって使い回す
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const wobble = (v, amount = 0.04) => v * (1 + (Math.random() * 2 - 1) * amount);

  // 音の部品：減衰する正弦波
  // glide を渡すと、decay の間に音程がその高さまで滑る
  function tone(freq, { at = 0, gain = 0.1, decay = 0.2, type = 'sine', attack = 0.004, glide = null } = {}) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  // 音の部品：フィルターを通した雑音
  function hiss({ at = 0, gain = 0.1, decay = 0.05, type = 'bandpass', freq = 3000, q = 1, sweepTo = null, attack = 0.002 } = {}) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(decay, attack + 0.01));
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  }

  const Sound = {
    // 碁石を置く「パチッ」：短い雑音の打音 ＋ 木の響き
    place(at = 0, scale = 1) {
      hiss({ at, gain: 0.32 * scale, decay: 0.035, freq: wobble(3400), q: 1.6 });
      tone(wobble(560), { at, gain: 0.09 * scale, decay: 0.07 });
      tone(wobble(150), { at, gain: 0.12 * scale, decay: 0.09 });
    },
    // 取り合いでコマを取る：置く音より軽く
    pick() { Sound.place(0, 0.55); tone(wobble(1250), { gain: 0.025, decay: 0.08 }); },
    // 手札を選ぶ：ごく小さなカチッ
    select() { tone(wobble(1700, 0.02), { gain: 0.03, decay: 0.03 }); },
    // 石が動く：こすれる音
    move(at = 0) { hiss({ at, gain: 0.05, decay: 0.26, freq: 1100, sweepTo: 380, q: 0.9 }); },
    // 石が消える：低いボフッ
    gone(at = 0) {
      hiss({ at, gain: 0.09, decay: 0.22, type: 'lowpass', freq: 700, sweepTo: 160, q: 0.7 });
      tone(wobble(95), { at, gain: 0.1, decay: 0.22 });
    },
    // 石が返る：軽い2回のカチッ
    flip(at = 0) { Sound.place(at, 0.4); Sound.place(at + 0.07, 0.35); },
    // 勝ち：短い長三和音を上へ
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, gain: 0.045, decay: 0.9, type: 'triangle', attack: 0.01 })); },
    // 負け・引き分け：静かに下がる2音
    lose() { [440, 349.23].forEach((f, i) => tone(f, { at: i * 0.16, gain: 0.04, decay: 0.8, type: 'triangle', attack: 0.01 })); },
    // ボタンが画面いっぱいに広がる：雑音を高いほうへ持ち上げる、やわらかい風の音
    whoosh() {
      hiss({ gain: 0.05, decay: 0.3, freq: 300, sweepTo: 1600, q: 0.8 });
      tone(392, { at: 0.18, gain: 0.03, decay: 0.5, type: 'triangle', attack: 0.02 });
    },
    // 予兆の「ため」：属性の高さで、だんだん大きくなる音。dur 秒で最大になって、弾ける直前で切れる
    charge(el, dur = 0.25) {
      const base = { fire: 110, earth: 80, gravity: 140, thunder: 300, wind: 260, vortex: 200, water: 330, curse: 120, shadow: 100, plant: 392, light: 523, invert: 440 }[el] || 220;
      hiss({ gain: 0.05, decay: dur, attack: dur * 0.95, type: 'bandpass', freq: base * 3, sweepTo: base * 9, q: 1.2 });
      tone(base, { gain: 0.035, decay: dur, attack: dur * 0.9, type: 'triangle', glide: base * 1.5 });
    },
    // 衝撃：属性ごとに、演出の形と同じ性格の音
    impact(el, opts = {}) {
      const S = ELEMENT_SOUNDS[el];
      if (S) S(opts);
    },
    // 壊れた石のかけら：跳ねるたびに小さく鳴る（2回）
    shards(n = 1, at = 0.1) {
      for (let i = 0; i < Math.min(n, 4); i++) {
        Sound.place(at + 0.28 + i * 0.03, 0.22);
        Sound.place(at + 0.5 + i * 0.03, 0.12);
      }
    },
    // 1つの段階の演出（fx の種類）に合わせて鳴らす
    fx(list, at = 0) {
      const kinds = new Set(list.map((f) => f.kind));
      if (kinds.has('moved')) Sound.move(at);
      const gone = list.filter((f) => f.kind === 'gone');
      if (gone.length) Sound.shards(gone.length, at);
      if (gone.some((f) => f.by === 'go')) ELEMENT_SOUNDS.earth({ pw: 0.6, at });
      if (gone.some((f) => f.by === 'mine')) ELEMENT_SOUNDS.thunder({ pw: 0.8, at });
      if (list.some((f) => f.kind === 'placed' && f.by === 'grow')) ELEMENT_SOUNDS.plant({ pw: 0.6, at });
      if (kinds.has('flipped')) Sound.flip(at);
      if (kinds.has('neutralized')) tone(660, { at: at + 0.25, gain: 0.03, decay: 0.25, glide: 330, type: 'triangle' });
    },
    get muted() { return muted; },
    setMuted(v) {
      muted = v;
      try { localStorage.setItem('gomoku-muted', v ? '1' : '0'); } catch (e) { /* 保存できなくても鳴らし分けは効く */ }
      if (!v) Sound.select();
    },
  };
  // ===== 属性ごとの衝撃の音（どれも角のない波形と、フィルターを通した雑音だけ） =====
  const ELEMENT_SOUNDS = {
    // 炎：低いドンと、雑音の爆発が下がっていき、少し遅れてパチパチ
    fire({ pw = 1, at = 0 } = {}) {
      tone(wobble(70), { at, gain: 0.16 * pw, decay: 0.45, glide: 38 });
      hiss({ at, gain: 0.12 * pw, decay: 0.55, type: 'lowpass', freq: 2600, sweepTo: 180, q: 0.7 });
      for (let i = 0; i < 6; i++) hiss({ at: at + 0.12 + Math.random() * 0.4, gain: 0.03, decay: 0.02, freq: wobble(3000, 0.3), q: 2 });
    },
    // 風：ヒューッと高いほうへ吹き抜けて、戻る
    wind({ at = 0 } = {}) {
      hiss({ at, gain: 0.07, decay: 0.22, attack: 0.08, freq: 500, sweepTo: 2400, q: 1.5 });
      hiss({ at: at + 0.18, gain: 0.04, decay: 0.3, attack: 0.03, freq: 2000, sweepTo: 700, q: 1.2 });
    },
    // 渦：吸い込み（下がる）か、回る（ゆらゆら揺れる）
    vortex({ contract = true, at = 0 } = {}) {
      if (contract) {
        tone(660, { at, gain: 0.05, decay: 0.5, glide: 120, type: 'triangle' });
        hiss({ at, gain: 0.05, decay: 0.5, attack: 0.15, freq: 2400, sweepTo: 300, q: 2 });
        tone(140, { at: at + 0.44, gain: 0.07, decay: 0.15 });
      } else {
        for (let i = 0; i < 4; i++) tone(wobble(330 + (i % 2) * 110, 0.02), { at: at + i * 0.08, gain: 0.035, decay: 0.16, type: 'triangle' });
        hiss({ at, gain: 0.04, decay: 0.4, attack: 0.1, freq: 900, sweepTo: 1600, q: 3 });
      }
    },
    // 重力：落ちて（音程が下がって）ドスン。反重力は逆に昇る
    gravity({ dir = 1, at = 0 } = {}) {
      if (dir > 0) {
        tone(520, { at, gain: 0.05, decay: 0.16, glide: 160, type: 'triangle' });
        tone(wobble(65), { at: at + 0.14, gain: 0.15, decay: 0.3, glide: 45 });
        hiss({ at: at + 0.14, gain: 0.05, decay: 0.15, type: 'lowpass', freq: 600 });
      } else {
        tone(160, { at, gain: 0.05, decay: 0.3, glide: 900, type: 'triangle' });
        tone(1046.5, { at: at + 0.26, gain: 0.03, decay: 0.3 });
      }
    },
    // 大地：重いドスと、砂利のザラッ
    earth({ pw = 1, at = 0 } = {}) {
      tone(wobble(58), { at, gain: 0.17 * pw, decay: 0.35, glide: 40 });
      hiss({ at, gain: 0.07 * pw, decay: 0.12, type: 'lowpass', freq: 900 });
      for (let i = 0; i < 5; i++) hiss({ at: at + 0.06 + i * 0.04 + Math.random() * 0.03, gain: 0.03 * pw, decay: 0.03, freq: wobble(1400, 0.4), q: 1.5 });
    },
    // 水面：ポチャン（音程が上がる短い音）と、遅れた小さな波紋
    water({ at = 0 } = {}) {
      tone(300, { at, gain: 0.08, decay: 0.12, glide: 900 });
      tone(500, { at: at + 0.12, gain: 0.035, decay: 0.12, glide: 1200 });
      tone(650, { at: at + 0.24, gain: 0.02, decay: 0.12, glide: 1400 });
    },
    // 呪い：半音でぶつかる低い2音が、閉じるように下がる
    curse({ at = 0 } = {}) {
      tone(220, { at, gain: 0.05, decay: 0.6, glide: 180, type: 'triangle', attack: 0.04 });
      tone(233.08, { at, gain: 0.045, decay: 0.6, glide: 175, type: 'triangle', attack: 0.04 });
      hiss({ at, gain: 0.04, decay: 0.45, attack: 0.3, type: 'lowpass', freq: 400, sweepTo: 1600, q: 2 });
      tone(110, { at: at + 0.32, gain: 0.06, decay: 0.3 });
    },
    // 影：こもったボフッ。ジョーカーは、きらめく高い音を重ねる
    shadow({ sparkle = false, at = 0 } = {}) {
      hiss({ at, gain: 0.08, decay: 0.4, type: 'lowpass', freq: 500, sweepTo: 150, q: 0.7 });
      tone(90, { at, gain: 0.07, decay: 0.3, glide: 60 });
      if (sparkle) [1318.5, 1568, 2093].forEach((f, i) => tone(f, { at: at + 0.1 + i * 0.06, gain: 0.025, decay: 0.35 }));
    },
    // 雷：鋭いバリッと、遠いゴロゴロ
    thunder({ pw = 1, at = 0 } = {}) {
      hiss({ at, gain: 0.12 * pw, decay: 0.06, type: 'highpass', freq: 2500, q: 0.7 });
      hiss({ at: at + 0.03, gain: 0.06 * pw, decay: 0.05, type: 'highpass', freq: 3500, q: 0.7 });
      hiss({ at: at + 0.06, gain: 0.08 * pw, decay: 0.6, attack: 0.05, type: 'lowpass', freq: 300, sweepTo: 90, q: 0.6 });
    },
    // 植物：音程の上がる、はじく音（ペンタトニック）と、葉のさらさら
    plant({ pw = 1, at = 0 } = {}) {
      [523.25, 659.25, 783.99].forEach((f, i) => tone(f, { at: at + i * 0.06, gain: 0.04 * pw, decay: 0.25, type: 'triangle' }));
      hiss({ at, gain: 0.025 * pw, decay: 0.3, attack: 0.08, freq: 5000, q: 1 });
    },
    // 光：明るい和音が一度に鳴って、余韻を残す
    light({ at = 0 } = {}) {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(f, { at: at + i * 0.015, gain: 0.03, decay: 0.8, type: i % 2 ? 'sine' : 'triangle', attack: 0.01 }));
    },
    // 反転：高い音と低い音が入れ替わる
    invert({ at = 0 } = {}) {
      tone(880, { at, gain: 0.045, decay: 0.1, glide: 440 });
      tone(440, { at: at + 0.09, gain: 0.045, decay: 0.12, glide: 880 });
      Sound.place(at + 0.02, 0.35);
    },
  };
  // 能力 → 音（形の組み合わせと同じ割り当て）
  const ABILITY_SOUND = {
    bomb: ['fire', { pw: 1 }], rowBomb: ['fire', { pw: 0.8 }], colBomb: ['fire', { pw: 0.8 }], diagBomb: ['fire', { pw: 0.8 }],
    push: ['wind', {}], suck: ['vortex', { contract: true }], spin: ['vortex', { contract: false }], spinBack: ['vortex', { contract: false }],
    gravity: ['gravity', { dir: 1 }], antigravity: ['gravity', { dir: -1 }],
    go: ['earth', { pw: 0.6 }], wall: ['earth', { pw: 0.8 }], weight: ['earth', { pw: 1.2 }], shield: ['earth', { pw: 0.5 }],
    clone: ['water', {}], cloneH: ['water', {}], cloneV: ['water', {}],
    seal: ['curse', {}], jam: ['curse', {}], spy: ['shadow', {}], joker: ['shadow', { sparkle: true }],
    mine: ['thunder', { pw: 0.7 }], chain: ['thunder', { pw: 1 }], grow: ['plant', {}],
    flag: ['light', {}], square: ['light', {}], othello: ['invert', {}], takeover: ['invert', {}],
  };
  Sound.ability = function (ability) {
    const s = ABILITY_SOUND[ability];
    if (s) ELEMENT_SOUNDS[s[0]](s[1]);
  };
  window.Sound = Sound;
})();
