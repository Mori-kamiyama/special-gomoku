// CPU の頭脳。ブラウザ（CPU 対戦）と Node（tools/balance.mjs）の両方から使う。
//   AI.chooseMove({ depth })  … 今の手番の手を選ぶ。{ i: 手札の番号, x, y } を返す
//   AI.draftPick(pool)        … 取り合いで取る碁石を選ぶ
// 読み方：depth 1 は自分の手だけを見る。depth 2 は minimax で、自分の手のうち良さそうな上位を、
// 相手（または連続で自分）のいちばん良い返し手まで読んで比べる。手札は公開なので、相手の次の手札も分かる。
(function () {
  const G = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./script.js')
    // ブラウザでは script.js のトップレベルの名前がそのまま見える
    : { state, SPECIAL_IDS, LINE_DIRS, SIZE, inside, other, countsFor, playMove, effectiveAbility, canPlaceAt, cardBlocked };

  // ===== 盤の評価：並びが長いほど、両端が空いているほど高い =====
  const SCORE = { 2: [1, 6, 25], 3: [6, 60, 400], 4: [30, 1500, 8000] };
  function lineScore(board, c) {
    let s = 0;
    for (const [dx, dy] of G.LINE_DIRS) {
      for (let y = 0; y < G.SIZE; y++) {
        for (let x = 0; x < G.SIZE; x++) {
          if (!G.countsFor(board[y][x], c)) continue;
          const px = x - dx, py = y - dy;
          if (G.inside(px, py) && G.countsFor(board[py][px], c)) continue;
          let len = 0, cx = x, cy = y;
          while (G.inside(cx, cy) && G.countsFor(board[cy][cx], c)) { len++; cx += dx; cy += dy; }
          if (len < 2) continue;
          const open = (G.inside(px, py) && !board[py][px] ? 1 : 0) + (G.inside(cx, cy) && !board[cy][cx] ? 1 : 0);
          s += len >= 5 ? 1e6 : SCORE[len][open];
        }
      }
    }
    return s;
  }

  // 特殊勝利（旗・結束）に近い形も評価する。あと1つでそろう形は、4つ並びと同じくらい高い
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function specialScore(board, c) {
    let s = 0;
    const at = (x, y) => (G.inside(x, y) ? board[y][x] : undefined);
    for (let y = 0; y < G.SIZE; y++) {
      for (let x = 0; x < G.SIZE; x++) {
        const p = board[y][x];
        if (!p || p.color !== c) continue;
        if (p.ability === 'flag') {
          const cells = D4.map(([dx, dy]) => at(x + dx, y + dy));
          if (cells.some((q) => q === undefined)) continue; // 端の旗はそろわない
          const own = cells.filter((q) => q && q.color === c).length;
          const empty = cells.filter((q) => !q).length;
          if (own + empty === 4) s += own === 3 ? 1500 : own === 2 ? 60 : 5;
        }
      }
    }
    return s;
  }

  function evaluate(me) {
    const st = G.state;
    if (st.phase === 'end') {
      if (st.winner === me) return 1e9;
      if (st.winner === G.other(me)) return -1e9;
      return 0;
    }
    const mine = lineScore(st.board, me) + specialScore(st.board, me);
    const theirs = lineScore(st.board, G.other(me)) + specialScore(st.board, G.other(me));
    return mine - 1.3 * theirs;
  }

  // ===== 状態の保存と復元（手を試すため） =====
  const KEYS = ['board', 'players', 'turn', 'selected', 'sealed', 'chainTurn', 'jammed', 'moveCount', 'phase', 'winner', 'winLine', 'lastMove'];
  // 状態のコピー。structuredClone より速いように、形の分かっているものだけを手で写す
  const copyPlayer = (p) => ({ ...p, bag: p.bag.map((c) => ({ ...c })), hand: p.hand.map((c) => ({ ...c })) });
  function clone(s) {
    const o = {};
    for (const k of KEYS) o[k] = s[k];
    o.board = s.board.map((row) => row.map((c) => c && { ...c }));
    o.players = { b: copyPlayer(s.players.b), w: copyPlayer(s.players.w) };
    o.winLine = s.winLine && s.winLine.map((q) => q.slice());
    o.lastMove = s.lastMove && s.lastMove.slice();
    return o;
  }
  function save() { return clone(G.state); }
  function restore(s) {
    Object.assign(G.state, clone(s));
    G.state.logs = [];
    G.state.fx = [];
  }

  // ===== 試すマス：石の近くを、まわりの石の多さで順位づけして上から取る =====
  function candidateCells(id, limit) {
    const st = G.state;
    const board = st.board;
    const near = [];
    const enemies = [];
    for (let y = 0; y < G.SIZE; y++) {
      for (let x = 0; x < G.SIZE; x++) {
        if (board[y][x]) {
          if (G.canPlaceAt(x, y, st.turn, id)) enemies.push([x, y]);
          continue;
        }
        let score = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if ((dx || dy) && G.inside(x + dx, y + dy) && board[y + dy][x + dx]) score += Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 3 : 1;
          }
        }
        if (score) near.push({ x, y, score: score + Math.random() });
      }
    }
    if (!near.length && !enemies.length) return [[5, 5], [4, 5], [5, 4], [6, 6]];
    near.sort((a, b) => b.score - a.score);
    return near.slice(0, limit).map((c) => [c.x, c.y]).concat(enemies.slice(0, 5));
  }

  function genMoves(limit) {
    const st = G.state;
    const moves = [];
    st.players[st.turn].hand.forEach((card, i) => {
      if (G.cardBlocked(card, st.turn)) return; // スパイは、相手にリーチがあると置けない
      for (const [x, y] of candidateCells(G.effectiveAbility(card, st.turn), limit)) moves.push({ i, x, y });
    });
    return moves;
  }

  function apply(m) {
    G.state.selected = m.i;
    return G.playMove(m.x, m.y);
  }

  function chooseMove(opts = {}) {
    const { depth = 2, cells = 14, topK = 8, replyCells = 10, noise = 6 } = opts;
    const st = G.state;
    const me = st.turn;
    const base = save();

    // 1手目：全部試して評価する
    const first = [];
    for (const m of genMoves(cells)) {
      restore(base);
      if (!apply(m).ok) continue;
      first.push({ m, score: evaluate(me), end: G.state.phase === 'end' });
    }
    restore(base);
    if (!first.length) return null;
    first.sort((a, b) => b.score - a.score);
    if (depth < 2 || first[0].score >= 1e9) {
      const top = first.filter((f) => f.score >= first[0].score - noise);
      return top[Math.floor(Math.random() * top.length)].m;
    }

    // 2手目：上位の手について、次に打つ人のいちばん良い返し手まで読む（minimax）
    let best = null;
    for (const f of first.slice(0, topK)) {
      let value = f.score;
      if (!f.end) {
        restore(base);
        apply(f.m);
        const after = save();
        const mover = G.state.turn; // 連続なら自分のまま
        const replies = genMoves(replyCells);
        let reply = null;
        for (const r of replies) {
          restore(after);
          if (!apply(r).ok) continue;
          const v = evaluate(me);
          if (reply === null || (mover === me ? v > reply : v < reply)) reply = v;
        }
        if (reply !== null) value = reply;
      }
      value += Math.random() * noise;
      if (!best || value > best.value) best = { m: f.m, value };
    }
    restore(base);
    return best.m;
  }

  // ===== 取り合い：計測で勝率が高かった順に取る（少しぶれる） =====
  // tools/balance.mjs の結果（取った側の勝率、%。depth 2・3000局）。計測をやり直したら更新する
  const PICK_VALUE = { othello: 47, spy: 45, takeover: 38, grow: 37, diagBomb: 36, spin: 35, bomb: 35, colBomb: 35, chain: 35, spinBack: 34, cloneV: 33, cloneH: 33, seal: 33, clone: 32, rowBomb: 32, suck: 32, flag: 31, push: 30, jam: 30, go: 30, weight: 29, shield: 29, antigravity: 29, wall: 28, joker: 27, mine: 26, gravity: 26 };
  function draftPick(pool) {
    let best = null;
    for (const card of pool) {
      const v = (PICK_VALUE[card.ability] || 40) + Math.random() * 4;
      if (!best || v > best.v) best = { card, v };
    }
    return best.card;
  }

  const AI = { chooseMove, draftPick, evaluate, lineScore, save, restore, PICK_VALUE };
  if (typeof module !== 'undefined') module.exports = AI;
  else window.AI = AI;
})();
