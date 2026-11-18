'use strict';

// ===== 定数 =====
const SIZE = 11;
const HAND_SIZE = 3;
const PLAIN_COUNT = 6;
// 取り合いには、毎回この数の種類を1つずつ並べる（重なりなし）
const DRAFT_POOL_SIZE = 12;
// 取る順番（0 = 黒, 1 = 白）。打つのと同じく黒から。3択から1つずつ、交互に取る
const DRAFT_ORDER = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
const OFFER_SIZE = 3; // 取り合いで毎回出す数
// CPU と対戦するときは、人が黒（先手）、CPU が白
const CPU_COLOR = 'w';
const CPU_DELAY_MS = 450;
const CPU_DRAFT_MS = 200;
const PICKS_PER_PLAYER = 6;
const BANNER_MS = 750;
const STEP_MS = 420; // 効果 → 重力 → 囲碁、と段階ごとに見せる間
const MAX_ROUNDS = 12; // 重力と罠のくり返しの上限
const COLORS = ['b', 'w'];
const COLOR_NAME = { b: '黒', w: '白' };

const DIRS8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
// まわり8マスを時計回りに
const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const LINE_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const other = (c) => (c === 'b' ? 'w' : 'b');

// ===== アイコン（24×24 の SVG。線は石の文字色で描く） =====
const ICONS = {
  gravity: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  antigravity: '<path d="M12 20V5M6 11l6-6 6 6"/>',
  spin: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.5 3.5v4h-4"/>',
  spinBack: '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M4.5 3.5v4h4"/>',
  push: '<path d="M12 8V3M9.5 5.5 12 3l2.5 2.5M12 16v5M9.5 18.5 12 21l2.5-2.5M8 12H3M5.5 9.5 3 12l2.5 2.5M16 12h5M18.5 9.5 21 12l-2.5 2.5"/>',
  suck: '<path d="M12 3v5M9.5 5.5 12 8l2.5-2.5M12 21v-5M9.5 18.5 12 16l2.5 2.5M3 12h5M5.5 9.5 8 12l-2.5 2.5M21 12h-5M18.5 9.5 16 12l2.5 2.5"/>',
  bomb: '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/>',
  rowBomb: '<path d="M2.5 12h19M5.5 8.5v7M18.5 8.5v7"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  colBomb: '<path d="M12 2.5v19M8.5 5.5h7M8.5 18.5h7"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  diagBomb: '<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  othello: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
  go: '<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="4.5" r="2"/><circle cx="12" cy="19.5" r="2"/><circle cx="4.5" cy="12" r="2"/><circle cx="19.5" cy="12" r="2"/>',
  joker: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" stroke="none"/>',
  chain: '<path d="M4.5 6l6 6-6 6M12.5 6l6 6-6 6"/>',
  clone: '<circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4" fill="currentColor"/>',
  cloneH: '<circle cx="6.5" cy="12" r="3.5"/><circle cx="17.5" cy="12" r="3.5" fill="currentColor"/><path d="M12 4v16" stroke-dasharray="2 2.5"/>',
  cloneV: '<circle cx="12" cy="6.5" r="3.5"/><circle cx="12" cy="17.5" r="3.5" fill="currentColor"/><path d="M4 12h16" stroke-dasharray="2 2.5"/>',
  wall: '<rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 12h16M11 6v6M8 12v6M15 12v6"/>',
  takeover: '<path d="M4 19h16M5 16 4 7l5 4 3-6 3 6 5-4-1 9z"/>',
  seal: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  jam: '<path d="M6 6l12 12M18 6 6 18"/>',
  spy: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  mine: '<circle cx="12" cy="13" r="5.5"/><path d="M12 3.5v3.5M12 19v2M3.5 13h3M17.5 13h3M6 7l2 2M18 7l-2 2"/>',
  weight: '<path d="M6.5 20h11l-2-9h-7z"/><path d="M9.5 11V8.5a2.5 2.5 0 0 1 5 0V11"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
  flag: '<path d="M6.5 21V3.5M6.5 4.5h11l-2.8 4 2.8 4h-11"/>',
  square: '<rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.2"/><rect x="13" y="4.5" width="6.5" height="6.5" rx="1.2"/><rect x="4.5" y="13" width="6.5" height="6.5" rx="1.2"/><rect x="13" y="13" width="6.5" height="6.5" rx="1.2" fill="currentColor"/>',
  grow: '<path d="M12 21v-8.5"/><path d="M12 13c0-4.2 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5zM12 15c0-3.3-2.4-5.3-6-5.3 0 3.3 2.4 5.3 6 5.3z"/>',
};

// ===== 超能力 =====
// 能力を足すときは、ここに1件足す（アイコンは ICONS に同じ id で足す）。
//   onPlace(board, x, y, color, state) … 置いたときの効果。盤を書き換え、演出用の fx 配列を返す
//     fx の kind: placed / moved（fromX, fromY つき）/ flipped / gone
//   extraTurn … 置いたあと、もう1手打てる
//   onEnemy … 相手の石の上に置ける
//   area … 置く前に、効果の届く範囲を盤に薄く出す
// 盤にある間ずっと効くもの（重力・反重力・囲碁・地雷・重し・盾）は、resolve() とその下の関数で扱う。
// 揃いの数え方は countLine() と lineOwner() で扱う（joker / spy）。
// 外したもの：四目・ダブル（時間を縮めても強すぎた）、磁石・寂しがり（動きが分かりにくかった）、裏返し（強すぎた）
const ABILITIES = {
  plain: { name: 'ただの石', desc: '' },
  block: { name: '石垣', desc: '' }, // 石垣が立てる、誰のものでもない石
  joker: { name: 'ジョーカー', desc: '白にも黒にもなる。相手の列にも入る' },
  push: { name: '押し出し', desc: 'まわりの石を1マス外へ押す。盤から落ちた石は消える', onPlace: pushAbility, area: 'ring' },
  suck: { name: '吸い込み', desc: '2マス先の石を1マス手前まで吸い寄せる', onPlace: suckAbility, area: 'ring2' },
  bomb: { name: '爆弾', desc: 'まわりの石を全部消す', onPlace: bombAbility, area: 'ring' },
  rowBomb: { name: '横爆弾', desc: '左右2マスずつの石を消す', onPlace: (b, x, y) => lineBomb(b, x, y, [[1, 0]]), area: 'row' },
  colBomb: { name: '縦爆弾', desc: '上下2マスずつの石を消す', onPlace: (b, x, y) => lineBomb(b, x, y, [[0, 1]]), area: 'col' },
  diagBomb: { name: 'ななめ爆弾', desc: 'ななめ4方向に2マスずつの石を消す', onPlace: (b, x, y) => lineBomb(b, x, y, [[1, 1], [1, -1]]), area: 'diag' },
  flag: { name: '旗', desc: '上下左右の4マスが全部自分の石になったら勝ち', area: 'cross' },
  square: { name: '結束', desc: 'この碁石を含む2×2の正方形が自分の石でそろったら勝ち', area: 'square' },
  grow: { name: '増殖', desc: '盤にある間、自分の番が2回来るたびに、隣の空きマスに石が1つ増える', area: 'cross' },
  othello: { name: 'オセロ', desc: '相手の石をちょうど1個はさんだら、その石を自分の色にする', onPlace: othelloAbility },
  go: { name: '囲碁', desc: '盤にある間、隣の相手の石が囲まれて逃げ場をなくしたら取る', area: 'cross' },
  chain: { name: '連続', desc: 'もう1回置ける', extraTurn: true },
  gravity: { name: '重力', desc: 'いつでも下へ落ちる。石か盤の端で止まる', area: 'down' },
  antigravity: { name: '反重力', desc: 'いつでも上へ昇る。石か盤の端で止まる', area: 'up' },
  spin: { name: '回転', desc: 'まわりの8マスを、時計回りに1つずらす', onPlace: (b, x, y) => spinRing(b, x, y, 1), area: 'ring' },
  spinBack: { name: '逆回転', desc: 'まわりの8マスを、反時計回りに1つずらす', onPlace: (b, x, y) => spinRing(b, x, y, -1), area: 'ring' },
  clone: { name: '分身', desc: '盤の真ん中をはさんだ反対側にも、自分の石が1つ増える', onPlace: (b, x, y, c, st) => cloneAt(b, SIZE - 1 - x, SIZE - 1 - y, c, st), area: 'mirror' },
  cloneH: { name: '左右分身', desc: '左右に折り返した位置にも、自分の石が1つ増える', onPlace: (b, x, y, c, st) => cloneAt(b, SIZE - 1 - x, y, c, st), area: 'mirrorH' },
  cloneV: { name: '上下分身', desc: '上下に折り返した位置にも、自分の石が1つ増える', onPlace: (b, x, y, c, st) => cloneAt(b, x, SIZE - 1 - y, c, st), area: 'mirrorV' },
  wall: { name: '石垣', desc: '上下左右の空きマスに、誰のものでもない石を置く', onPlace: wallAbility, area: 'cross' },
  takeover: { name: '乗っ取り', desc: '相手の石の上に置ける。下の石は消える', onEnemy: true },
  seal: { name: '封印', desc: '相手は次の番、超能力が使えない', onPlace: sealAbility },
  jam: { name: 'おじゃま', desc: 'まわり8マスの碁石の超能力を消して、ただの石にする', onPlace: jamAbility, area: 'ring' },
  spy: { name: 'スパイ', desc: '相手の色で置く。この石を含む列が揃ったら、こっちの勝ち' },
  mine: { name: '地雷', desc: 'まわり8マスに相手が石を置いたら、その石と一緒に消える', area: 'ring' },
  weight: { name: '重し', desc: '押し出し・吸い込み・回転で動かされない' },
  shield: { name: '盾', desc: '爆弾・囲碁・地雷・乗っ取りで消されない' },
};
const HIDDEN_IDS = ['plain', 'block'];
const SPECIAL_IDS = Object.keys(ABILITIES).filter((id) => !HIDDEN_IDS.includes(id));

// ===== 動かす・消すの共通の決まり（重しは動かない、盾は消えない） =====
const isFixed = (cell) => !!cell && cell.ability === 'weight';
const isShielded = (cell) => !!cell && cell.ability === 'shield';

function moveStone(board, fx, fromX, fromY, toX, toY) {
  board[toY][toX] = board[fromY][fromX];
  board[fromY][fromX] = null;
  fx.push({ kind: 'moved', x: toX, y: toY, fromX, fromY });
}

function removeStone(board, fx, x, y) {
  const cell = board[y][x];
  if (!cell || isShielded(cell)) return false;
  board[y][x] = null;
  fx.push({ kind: 'gone', x, y, color: cell.color });
  return true;
}

let uidCounter = 0;
const newPiece = (color, ability, st, extra = {}) => ({ color, ability, placedAt: st ? st.moveCount : 0, uid: ++uidCounter, ...extra });

// ===== 置いたときの効果 =====
function pushAbility(board, x, y) {
  const fx = [];
  for (const [dx, dy] of DIRS8) {
    const nx = x + dx, ny = y + dy;
    if (!inside(nx, ny) || !board[ny][nx] || isFixed(board[ny][nx])) continue;
    const tx = nx + dx, ty = ny + dy;
    if (!inside(tx, ty)) removeStone(board, fx, nx, ny);
    else if (!board[ty][tx]) moveStone(board, fx, nx, ny, tx, ty);
    // 押す先がふさがっていたら動かない
  }
  return fx;
}

// 押し出しの逆。2マス先の石を、あいだが空いていれば1マス手前へ
function suckAbility(board, x, y) {
  const fx = [];
  for (const [dx, dy] of DIRS8) {
    const nx = x + dx, ny = y + dy, fx2 = x + dx * 2, fy2 = y + dy * 2;
    if (!inside(fx2, fy2) || !board[fy2][fx2] || isFixed(board[fy2][fx2]) || board[ny][nx]) continue;
    moveStone(board, fx, fx2, fy2, nx, ny);
  }
  return fx;
}

// 爆弾：まわりの石を消す。置いた碁石は残る（自分も消えると、置く得がなかった）
function bombAbility(board, x, y) {
  const fx = [];
  for (const [dx, dy] of DIRS8) if (inside(x + dx, y + dy)) removeStone(board, fx, x + dx, y + dy);
  return fx;
}

// 列の爆弾が届く距離。盤の端まで届くと強すぎたので2マスにした
const LINE_BOMB_RANGE = 2;
function lineBomb(board, x, y, dirs) {
  const fx = [];
  for (const [dx, dy] of dirs) {
    for (let k = -LINE_BOMB_RANGE; k <= LINE_BOMB_RANGE; k++) {
      if (k === 0) continue;
      const cx = x + dx * k, cy = y + dy * k;
      if (inside(cx, cy)) removeStone(board, fx, cx, cy);
    }
  }
  return fx;
}

// ちょうど1個の相手の石をはさんだときだけ、その石を返す（全部返す・何個でも1つ返す、はどちらも強すぎた）。
// 返すのは1つだけ。はさめる向きが2つ以上あれば、DIRS8 の順で先の向き
function othelloAbility(board, x, y, color) {
  for (const [dx, dy] of DIRS8) {
    const mid = inside(x + dx, y + dy) && board[y + dy][x + dx];
    const end = inside(x + dx * 2, y + dy * 2) && board[y + dy * 2][x + dx * 2];
    if (mid && mid.color === other(color) && end && end.color === color) {
      mid.color = color;
      return [{ kind: 'flipped', x: x + dx, y: y + dy }];
    }
  }
  return [];
}

// まわり8マスを、dir = 1 で時計回り、-1 で反時計回りに1つずらす。重しのマスは飛ばす
function spinRing(board, x, y, dir) {
  const fx = [];
  const ring = RING.map(([dx, dy]) => [x + dx, y + dy]).filter(([cx, cy]) => inside(cx, cy) && !isFixed(board[cy][cx]));
  const values = ring.map(([cx, cy]) => board[cy][cx]);
  ring.forEach(([cx, cy], i) => {
    const from = (i - dir + ring.length) % ring.length;
    board[cy][cx] = values[from];
    if (values[from] && from !== i) fx.push({ kind: 'moved', x: cx, y: cy, fromX: ring[from][0], fromY: ring[from][1] });
  });
  return fx;
}

function cloneAt(board, cx, cy, color, st) {
  if (!board[cy][cx]) {
    board[cy][cx] = newPiece(color, 'plain', st);
    return [{ kind: 'placed', x: cx, y: cy }];
  }
  return [];
}

function wallAbility(board, x, y, color, st) {
  const fx = [];
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx, ny = y + dy;
    if (inside(nx, ny) && !board[ny][nx]) {
      board[ny][nx] = newPiece('n', 'block', st);
      fx.push({ kind: 'placed', x: nx, y: ny });
    }
  }
  return fx;
}

function sealAbility(board, x, y, color, st) {
  if (st) st.sealed = other(color);
  return [];
}

// おじゃま：まわり8マスの碁石（白黒どちらも）の超能力を消して、ただの石にする。
// 相手の手札の碁石を1つ消す形は、強すぎた
function jamAbility(board, x, y) {
  const fx = [];
  for (const [dx, dy] of DIRS8) {
    const cell = inside(x + dx, y + dy) && board[y + dy][x + dx];
    if (cell && cell.color !== 'n' && cell.ability !== 'plain') {
      cell.ability = 'plain';
      delete cell.owner;
      fx.push({ kind: 'neutralized', x: x + dx, y: y + dy });
    }
  }
  return fx;
}

// ===== 盤にある間ずっと効くもの =====
// 重力の石は下へ、反重力の石は上へ、止まるまで動かす。重力は下の行から、反重力は上の行から順に動かす
function settle(board) {
  const fx = [];
  for (let y = SIZE - 2; y >= 0; y--) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] && board[y][x].ability === 'gravity') slideStone(board, fx, x, y, 0, 1);
    }
  }
  for (let y = 1; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] && board[y][x].ability === 'antigravity') slideStone(board, fx, x, y, 0, -1);
    }
  }
  return fx;
}

function slideStone(board, fx, x, y, dx, dy) {
  let tx = x, ty = y;
  while (inside(tx + dx, ty + dy) && !board[ty + dy][tx + dx]) { tx += dx; ty += dy; }
  if (tx !== x || ty !== y) moveStone(board, fx, x, y, tx, ty);
}

// 囲碁の石の上下左右にある相手のかたまりに、空きマス（逃げ場）がなければ取る
function goTraps(board) {
  const fx = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const go = board[y][x];
      if (!go || go.ability !== 'go' || go.color === 'n') continue;
      const enemy = other(go.color);
      for (const [dx, dy] of DIRS4) {
        const sx = x + dx, sy = y + dy;
        if (!inside(sx, sy) || !board[sy][sx] || board[sy][sx].color !== enemy) continue;
        const group = groupOf(board, sx, sy);
        if (!group.free) {
          const before = fx.length;
          for (const [gx, gy] of group.cells) removeStone(board, fx, gx, gy);
          for (let i = before; i < fx.length; i++) fx[i].by = 'go';
        }
      }
    }
  }
  return fx;
}

function groupOf(board, sx, sy) {
  const color = board[sy][sx].color;
  const seen = new Set([`${sx},${sy}`]);
  const stack = [[sx, sy]];
  const cells = [];
  let free = false;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    cells.push([cx, cy]);
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx, ny = cy + dy;
      if (!inside(nx, ny)) continue;
      const cell = board[ny][nx];
      if (!cell) free = true;
      else if (cell.color === color && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); stack.push([nx, ny]); }
    }
  }
  return { cells, free };
}

// 置いた石のまわり8マスに相手の地雷があれば、置いた石と地雷が一緒に消える
function mineCheck(board, uid) {
  const fx = [];
  const pos = findUid(board, uid);
  if (!pos) return fx;
  const [x, y] = pos;
  const placed = board[y][x];
  for (const [dx, dy] of DIRS8) {
    const mx = x + dx, my = y + dy;
    const m = inside(mx, my) && board[my][mx];
    if (m && m.ability === 'mine' && m.color !== placed.color) {
      removeStone(board, fx, mx, my);
      removeStone(board, fx, x, y);
      for (const f of fx) f.by = 'mine';
      break;
    }
  }
  return fx;
}

function findUid(board, uid) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (board[y][x] && board[y][x].uid === uid) return [x, y];
  return null;
}

// 増殖：手番の人の増殖の石は、その人の番が来るたびに1つ年をとり、2回に1回、隣の空きマスに石を増やす。
// 増やす向きは、上 → 右 → 下 → 左 の順に回していく
function growth(board, color, st) {
  const fx = [];
  const seeds = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const p = board[y][x];
    if (p && p.ability === 'grow' && p.color === color) seeds.push([x, y, p]);
  }
  for (const [x, y, p] of seeds) {
    p.age = (p.age || 0) + 1;
    if (p.age % 2 !== 0) continue;
    const start = (p.age / 2) % 4;
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = DIRS4[(start + k) % 4];
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny) && !board[ny][nx]) {
        board[ny][nx] = newPiece(color, 'plain', st);
        fx.push({ kind: 'placed', x: nx, y: ny, by: 'grow', fromX: x, fromY: y });
        break;
      }
    }
  }
  return fx;
}

// ===== 勝ち判定 =====
const countsFor = (cell, c) => !!cell && (cell.color === c || cell.ability === 'joker');

// 色 c で揃っている列を探す。見つかればマスの座標配列、なければ null
function findWin(board, c) {
  for (const [dx, dy] of LINE_DIRS) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!countsFor(board[y][x], c)) continue;
        const px = x - dx, py = y - dy;
        if (inside(px, py) && countsFor(board[py][px], c)) continue; // 列の先頭だけ見る
        const cells = [];
        let cx = x, cy = y;
        while (inside(cx, cy) && countsFor(board[cy][cx], c)) {
          cells.push([cx, cy]);
          cx += dx; cy += dy;
        }
        if (countLine(cells.map(([qx, qy]) => board[qy][qx]), c)) return cells;
      }
    }
  }
  return null;
}

function countLine(pieces, c) {
  if (!pieces.some((p) => p.color === c)) return false; // ジョーカーだけの列は数えない
  return pieces.length >= 5;
}

// 特殊勝利：旗の上下左右が全部自分の石／結束を含む2×2が全部自分の石。そろったマスを返す
function specialWin(board, c) {
  const own = (x, y) => inside(x, y) && board[y][x] && board[y][x].color === c;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = board[y][x];
      if (!p || p.color !== c) continue;
      if (p.ability === 'flag' && DIRS4.every(([dx, dy]) => own(x + dx, y + dy))) {
        return [[x, y], ...DIRS4.map(([dx, dy]) => [x + dx, y + dy])];
      }
      if (p.ability === 'square') {
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
          const cells = [[x + ox, y + oy], [x + ox + 1, y + oy], [x + ox, y + oy + 1], [x + ox + 1, y + oy + 1]];
          if (cells.every(([cx, cy]) => own(cx, cy))) return cells;
        }
      }
    }
  }
  return null;
}

// 揃った列の勝ち主。相手のスパイが混ざっていれば、スパイを置いた側の勝ち
function lineOwner(board, cells, c) {
  const spy = cells.map(([x, y]) => board[y][x]).find((p) => p.ability === 'spy' && p.owner && p.owner !== c);
  return spy ? spy.owner : c;
}

// ===== 碁石 =====
let nextId = 1;
const makeCard = (ability) => ({ id: nextId++, ability });

// 乱数：オンライン対戦で両方の画面を同じ流れにするため、種（シード）から決まる乱数を使う。
// 種を決めると、碁石の番号も1から振り直す（両方の画面で同じ番号になる）
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = Math.random;
function setSeed(seed) { rng = mulberry32(seed); nextId = 1; }
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 全種類から12種類を選び、1つずつ並べる（重なりなし）
function makeDraftPool() {
  return shuffle(SPECIAL_IDS).slice(0, DRAFT_POOL_SIZE).map(makeCard);
}

function makePlayer(color, picks) {
  const deck = picks.concat(Array.from({ length: PLAIN_COUNT }, () => makeCard('plain')));
  const p = { color, bag: shuffle(deck), hand: [] };
  fillHand(p);
  return p;
}

// 手札が3つになるまで引く。袋が空なら、それ以上は引かない
function fillHand(p) {
  while (p.hand.length < HAND_SIZE && p.bag.length) p.hand.push(p.bag.pop());
}

const piecesLeft = (p) => p.hand.length + p.bag.length;

// ===== 状態 =====
const state = {
  phase: 'title', // title | draft | play | end
  mode: 'pvp', // pvp（2人で対戦）| cpu（CPU と対戦）
  board: [],
  pool: [],
  picks: { b: [], w: [] },
  draftStep: 0,
  draftFocus: null,
  players: {},
  turn: 'b',
  selected: 0,
  sealed: null, // 次の番に超能力が使えない色
  jammed: null,
  lastMove: null,
  fx: [],
  winLine: null,
  moveCount: 0,
  busy: false,
  pending: null, // タッチ操作で、1回目にタップしたマス
  logs: [],
};

// 画面とログに出す名前。CPU 対戦では「あなた」と「CPU」
const nameOf = (c) => (state.mode === 'cpu' ? (c === CPU_COLOR ? 'CPU' : 'あなた')
  : state.mode === 'online' ? (c === state.myColor ? 'あなた' : '相手') : COLOR_NAME[c]);

function log(text) {
  state.logs.unshift(text);
  if (typeof document !== 'undefined') renderLog();
}

// 封印されているときは、どの碁石もただの石として置く
function effectiveAbility(card, color) {
  return state.sealed === color ? 'plain' : card.ability;
}

function canPlaceAt(x, y, color, ability) {
  if (!inside(x, y)) return false;
  const cell = state.board[y][x];
  if (!cell) return true;
  return !!ABILITIES[ability].onEnemy && cell.color === other(color) && !isShielded(cell);
}

const snapshot = (board) => board.map((row) => row.map((c) => c && { ...c }));

// ===== 1つ置いたときに起きることを、全部進める =====
// 対局（playMove）と、取り合いのお試し（fx.js のデモ）の両方で使う。どちらも同じ動きになる。
// 順番：能力の効果 → 増殖 → 重力・反重力 → 囲碁と地雷 →（変わらなくなるまで重力と囲碁をくり返す）
// st は対局の状態（封印・おじゃまが相手の手札を見るため）。お試しでは手札のない仮の状態を渡す
function resolvePlacement(board, x, y, color, id, st) {
  const ab = ABILITIES[id];
  const piece = id === 'spy' ? newPiece(other(color), 'spy', st, { owner: color }) : newPiece(color, id, st);
  board[y][x] = piece;
  const before = snapshot(board); // 置いた直後、効果が起きる前（予兆を見せるため）
  const fx0 = ab.onPlace ? ab.onPlace(board, x, y, color, st) : [];
  const steps = [{ board: snapshot(board), fx: [{ kind: 'placed', x, y }, ...fx0] }];
  const allFx = fx0.slice();
  const grown = growth(board, color, st);
  if (grown.length) { steps.push({ board: snapshot(board), fx: grown }); allFx.push(...grown); }
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const fx = settle(board);
    if (round === 0) fx.push(...mineCheck(board, piece.uid));
    fx.push(...goTraps(board));
    if (!fx.length) break;
    steps.push({ board: snapshot(board), fx });
    allFx.push(...fx);
  }
  return { piece, steps, allFx, before };
}

// ===== 1手を打つ（DOM に依存しない部分） =====
// 1手の中の順番：能力の効果 → 重力・反重力 → 囲碁と地雷 → （変わらなくなるまで重力と囲碁をくり返す）→ 勝ち判定
// 戻り値：{ ok, ability, steps, winner, extraTurn }。steps は段階ごとの盤と演出（画面で順に見せる）
function playMove(x, y) {
  const color = state.turn;
  const p = state.players[color];
  const card = p.hand[state.selected];
  if (state.phase !== 'play' || !card) return { ok: false };
  const id = effectiveAbility(card, color);
  if (!canPlaceAt(x, y, color, id)) return { ok: false };

  const wasSealed = state.sealed === color;
  p.hand.splice(state.selected, 1);
  state.selected = 0;
  state.moveCount++;

  const ab = ABILITIES[id];
  if (wasSealed) state.sealed = null;
  state.jammed = null;
  const { piece, steps, allFx, before } = resolvePlacement(state.board, x, y, color, id, state);
  state.lastMove = findUid(state.board, piece.uid);
  state.fx = steps[steps.length - 1].fx;

  let text = `${nameOf(color)}が${ab.name}を${colLabel(x)}${y + 1}に置いた${describeFx(allFx)}`;
  if (wasSealed && card.ability !== 'plain') text = `${nameOf(color)}は封印されていて、${ABILITIES[card.ability].name}がただの石になった`;
  log(text);
  if (id === 'seal') log(`${nameOf(other(color))}は次の番、超能力が使えない`);
  if (id === 'jam') { const n = allFx.filter((f) => f.kind === 'neutralized').length; log(n ? `まわりの碁石${n}個の超能力が消えた` : 'まわりに超能力の碁石がなかった'); }

  fillHand(p);

  // 勝ち判定（置いた場所と関係ないところに列ができることもあるので、盤全体を見る）
  let winner = null;
  for (const c of [color, other(color)]) {
    const normal = findWin(state.board, c);
    const special = normal ? null : specialWin(state.board, c);
    const line = normal || special;
    if (line) {
      winner = lineOwner(state.board, line, c);
      state.winLine = line;
      state.winKind = normal ? 'line' : special.length === 5 ? 'flag' : 'square';
      break;
    }
  }

  if (winner) {
    state.phase = 'end';
    state.winner = winner;
    log(`${nameOf(winner)}の勝ち`);
    return { ok: true, ability: id, steps, before, winner, extraTurn: false };
  }

  // 次の番。碁石がない人は飛ばし、2人ともなければ引き分け
  let next = ab.extraTurn ? color : other(color);
  if (!piecesLeft(state.players[next])) {
    log(`${nameOf(next)}は碁石を使い切った`);
    next = other(next);
  }
  const full = state.board.every((row) => row.every(Boolean));
  if (!piecesLeft(state.players[next]) || full) {
    state.phase = 'end';
    state.winner = null;
    log(full ? '盤が埋まって、引き分け' : '碁石がなくなって、引き分け');
  } else {
    if (ab.extraTurn && next === color) log(`${nameOf(color)}がもう1回`);
    state.turn = next;
  }
  return { ok: true, ability: id, steps, before, winner: null, extraTurn: !!ab.extraTurn };
}

function describeFx(fx) {
  const n = (k) => fx.filter((f) => f.kind === k).length;
  const parts = [];
  if (n('moved')) parts.push(`${n('moved')}個動いた`);
  if (n('flipped')) parts.push(`${n('flipped')}個ひっくり返った`);
  if (n('gone')) parts.push(`${n('gone')}個消えた`);
  if (n('placed')) parts.push(`${n('placed')}個増えた`);
  return parts.length ? `。${parts.join('、')}` : '';
}

const colLabel = (x) => 'ABCDEFGHIJK'[x];

function newBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

// ===== 画面 =====
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function showScreen(name) {
  for (const s of ['title', 'draft', 'game', 'online']) $(`${s}-screen`).hidden = s !== name;
  document.body.dataset.screen = name;
  $('log-btn').hidden = name !== 'game';
}

function iconHTML(ability) {
  const icon = ICONS[ability];
  return icon ? `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>` : '';
}

// 盤の上の碁石（増殖には、増えるまでのゲージを付ける）
function pieceHTML(p, extraClass = '', attrs = '') {
  const html = stoneHTML(p.color, p.ability, extraClass, attrs);
  if (p.ability !== 'grow') return html;
  const n = (p.age || 0) % 2;
  const gauge = `<span class="grow-gauge" data-n="${n}" title="${n ? '次の自分の番で増える' : 'あと2回の自分の番で増える'}"><i></i><i></i></span>`;
  return html.replace(/<\/span>$/, `${gauge}</span>`);
}

function stoneHTML(color, ability, extraClass = '', attrs = '') {
  return `<span class="stone stone-${color} ${extraClass}" ${attrs}>${iconHTML(ability)}</span>`;
}

// --- 碁石とり（3択をくり返す） ---
// 毎回3つの碁石が出て、1つ取る。黒と白が交互に6回ずつ。12個を見比べるより速く決められる
const draftDone = () => state.draftStep >= DRAFT_ORDER.length;
const draftColor = () => COLORS[DRAFT_ORDER[Math.min(state.draftStep, DRAFT_ORDER.length - 1)]];
const isCpu = (color) => state.mode === 'cpu' && color === CPU_COLOR;
const isRemote = (color) => state.mode === 'online' && color !== state.myColor;
const notMine = (color) => isCpu(color) || isRemote(color); // この画面の人が操作できない番
const playerName = nameOf;

// まだ誰も取っていない種類から、3つ出す（重なりなし）
function makeOffer() {
  const taken = new Set([...state.picks.b, ...state.picks.w].map((c) => c.ability));
  return shuffle(SPECIAL_IDS.filter((id) => !taken.has(id))).slice(0, OFFER_SIZE).map(makeCard);
}

function startDraft(mode = state.mode, seed = newSeed()) {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  state.mode = mode;
  state.phase = 'draft';
  state.remoteQueue = [];
  setSeed(seed);
  state.picks = { b: [], w: [] };
  state.draftStep = 0;
  state.offer = makeOffer();
  state.draftFocus = null;
  state.busy = false;
  state.lastCallColor = null;
  state.logs = [];
  showScreen('draft');
  renderDraft();
  nextDraftTurn();
}

function renderDraft() {
  const color = draftColor();
  $('draft-screen').dataset.turn = color;
  $('draft-pool').classList.toggle('is-waiting', notMine(color));
  const who = $('phase-who');
  who.innerHTML = `<span class="who-stone stone-${color}"></span>${playerName(color)}！`;
  if (state.lastCallColor !== color) {
    who.classList.remove('is-pop'); void who.offsetWidth; who.classList.add('is-pop');
    state.lastCallColor = color;
  }

  // 取る順番の12枠。取った碁石で埋まっていく
  const filled = { b: 0, w: 0 };
  $('pick-track').innerHTML = DRAFT_ORDER.map((v, i) => {
    const c = COLORS[v];
    const card = i < state.draftStep ? state.picks[c][filled[c]++] : null;
    const cls = ['slot', `slot-${c}`];
    if (i === state.draftStep) cls.push('is-current');
    return `<li class="${cls.join(' ')}">${card ? stoneHTML(c, card.ability) : ''}</li>`;
  }).join('');

  // 3つのカード。属性の色を下地にし、マウスを乗せると属性の粒が動き出し、お試しの盤が出る
  Demo.stopAll();
  $('draft-pool').innerHTML = state.offer.map((card, i) => {
    const ab = ABILITIES[card.ability];
    const el = FX.elementOf(card.ability);
    const E = FX.ELEMENTS[el];
    return `<button type="button" class="tile card3 is-deal" data-id="${card.id}" data-ability="${card.ability}" style="--el-tint:${E.tint}; animation-delay:${i * 60}ms">
      <span class="tile-visual">${stoneHTML(color, card.ability)}<span class="tile-demo mini"></span></span>
      <span class="tile-text"><span class="tile-name">${ab.name}</span><span class="tile-desc">${ab.desc}</span></span>
    </button>`;
  }).join('');
  $('draft-pool').querySelectorAll('.tile').forEach((el) => {
    const id = Number(el.dataset.id);
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') focusTile(id); });
    el.addEventListener('pointerup', (e) => onTileTap(id, e.pointerType));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickDraft(id); } });
    el.addEventListener('focus', () => focusTile(id));
  });
  renderTileInfo();

  for (const c of COLORS) {
    const team = $(`team-${c}`);
    team.classList.toggle('is-active', c === color);
    const have = state.picks[c].length;
    const slots = Array.from({ length: PICKS_PER_PLAYER }, (_, i) => {
      const card = state.picks[c][i];
      if (card) return `<span class="team-piece" title="${ABILITIES[card.ability].name}：${ABILITIES[card.ability].desc}">${stoneHTML(c, card.ability)}</span>`;
      return `<span class="team-piece is-empty ${c === color && i === have ? 'is-next' : ''}"></span>`;
    }).join('');
    team.innerHTML = `<span class="team-name"><span class="turn-dot turn-${c}"></span>${playerName(c)}</span><div class="team-pieces">${slots}</div>`;
  }
}

// 広い画面ではカードの中で、スマホではカードの下の欄で、その碁石のお試しを流す
const isWide = () => window.matchMedia('(min-width: 900px)').matches;

function focusTile(id) {
  if (state.draftFocus === id && document.querySelector('.tile.is-demo, .tile.is-focus')) return;
  state.draftFocus = id;
  $('draft-pool').querySelectorAll('.tile').forEach((el) => {
    const on = Number(el.dataset.id) === id;
    el.classList.toggle('is-focus', on);
    const demo = el.querySelector('.tile-demo');
    const play = on && isWide() && Demo.has(el.dataset.ability);
    el.classList.toggle('is-demo', play);
    if (play) Demo.start(demo, el.dataset.ability); else { Demo.stop(demo); demo.innerHTML = ''; }
  });
  renderTileInfo();
}

function renderTileInfo() {
  const card = state.offer.find((c) => c.id === state.draftFocus);
  const el = $('tile-info');
  const old = el.querySelector('.info-demo');
  if (old) Demo.stop(old);
  if (!card) { el.innerHTML = ''; return; }
  const ab = ABILITIES[card.ability];
  el.innerHTML = `<span class="info-demo mini"></span><span class="info-text"><b>${ab.name}</b>${ab.desc}</span>`;
  if (!isWide() && Demo.has(card.ability)) Demo.start(el.querySelector('.info-demo'), card.ability);
}

// タッチでは、1回目で説明とお試しを見て、2回目で取る
function onTileTap(id, pointerType) {
  if (state.busy || notMine(draftColor())) return;
  if ((pointerType === 'touch' || pointerType === 'pen') && state.draftFocus !== id) { focusTile(id); return; }
  pickDraft(id);
}

async function pickDraft(id, remote = false) {
  if (state.busy) return;
  const color = draftColor();
  const card = state.offer.find((c) => c.id === id);
  if (!card) return;
  if (state.mode === 'online' && !remote) Net.send('pick', { id });
  const tileStone = $('draft-pool').querySelector(`.tile[data-id="${id}"] .tile-visual > .stone`);
  const from = tileStone && tileStone.getBoundingClientRect();
  state.picks[color].push(card);
  state.draftStep++;
  state.draftFocus = null;
  state.offer = draftDone() ? [] : makeOffer();
  state.busy = true;
  renderDraft();
  // 取った碁石が、カードから自分の枠へ飛んでいく
  const slot = $(`team-${color}`).querySelectorAll('.team-piece')[state.picks[color].length - 1];
  if (from && slot) await flyTo(from, slot, stoneHTML(color, card.ability));
  Sound.pick();
  state.busy = false;
  if (draftDone()) { setTimeout(startGame, 150); return; }
  if (runRemoteQueue()) return;
  nextDraftTurn();
}

// CPU の番なら、少しだけ間をおいて、計測で強かった碁石から取る
function nextDraftTurn() {
  if (!isCpu(draftColor())) return;
  setTimeout(() => {
    const card = AI.draftPick(state.offer);
    focusTile(card.id);
    setTimeout(() => pickDraft(card.id), 200);
  }, CPU_DRAFT_MS);
}

function flyTo(fromRect, toEl, html) {
  return new Promise((resolve) => {
    const to = toEl.getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'flyer';
    flyer.innerHTML = html;
    Object.assign(flyer.style, { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px` });
    document.body.appendChild(flyer);
    toEl.classList.add('is-landing');
    const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2);
    const dy = to.top + to.height / 2 - (fromRect.top + fromRect.height / 2);
    const scale = to.width / fromRect.width;
    const anim = flyer.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + scale) / 2 * 1.15})`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ], { duration: 250, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' });
    anim.onfinish = () => { flyer.remove(); toEl.classList.remove('is-landing'); resolve(); };
  });
}

// --- 対局 ---
function startGame() {
  Demo.stopAll();
  state.phase = 'play';
  state.board = newBoard();
  state.players = { b: makePlayer('b', state.picks.b), w: makePlayer('w', state.picks.w) };
  state.turn = 'b';
  state.selected = 0;
  state.sealed = null;
  state.jammed = null;
  state.lastMove = null;
  state.fx = [];
  state.winLine = null;
  state.winner = undefined;
  state.moveCount = 0;
  state.pending = null;
  state.busy = false;
  state.lastActive = null;
  log('黒から');
  showScreen('game');
  buildBoard();
  renderGame();
  maybeCpuMove();
}

// CPU の番なら、少し考えるふりをしてから打つ（選んだ碁石を持ち上げ、置く場所に影を出してから置く）
async function maybeCpuMove() {
  if (state.phase !== 'play' || !isCpu(state.turn) || state.busy) return;
  state.busy = true;
  state.cpuThinking = true;
  $(`panel-${state.turn}`).classList.add('is-thinking');
  await sleep(CPU_DELAY_MS);
  const move = AI.chooseMove({ depth: 2 });
  $(`panel-${state.turn}`).classList.remove('is-thinking');
  state.busy = false;
  state.cpuThinking = false;
  if (!move) return;
  state.selected = move.i;
  renderPanel(state.turn);
  renderStatus();
  renderBoard();
  state.busy = true;
  showPreview(move.x, move.y, true);
  await sleep(500);
  clearPreview();
  state.busy = false;
  place(move.x, move.y);
}

function buildBoard() {
  const board = $('board');
  board.innerHTML = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      if (x === 0) cell.classList.add('edge-l');
      if (x === SIZE - 1) cell.classList.add('edge-r');
      if (y === 0) cell.classList.add('edge-t');
      if (y === SIZE - 1) cell.classList.add('edge-b');
      if ((x === 5 && y === 5) || ([2, 8].includes(x) && [2, 8].includes(y))) cell.classList.add('star');
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.setAttribute('aria-label', `${colLabel(x)}${y + 1}`);
      cell.addEventListener('pointerup', (e) => onCellTap(x, y, e.pointerType));
      cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellTap(x, y, 'key'); } });
      cell.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showPreview(x, y); });
      cell.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') clearPreview(); });
      board.appendChild(cell);
    }
  }
  // 演出の粒を描くキャンバス。盤より少し大きくして、粒がはみ出せるようにする
  const wrap = board.parentElement;
  if (!wrap.querySelector('.board-fx')) wrap.insertAdjacentHTML('beforeend', '<canvas class="board-fx" aria-hidden="true"></canvas>');
}

// 盤の座標 → 演出のキャンバスの位置
const FX_MARGIN = 60;
function boardTarget() {
  const board = $('board');
  const w = board.getBoundingClientRect().width;
  const pad = w * 0.025, cell = (w * 0.95) / SIZE;
  return {
    canvas: board.parentElement.querySelector('.board-fx'),
    cell,
    shakeEl: board.parentElement,
    dimEl: board,
    dimOffset: FX_MARGIN,
    map: (x, y) => [FX_MARGIN + pad + (x + 0.5) * cell, FX_MARGIN + pad + (y + 0.5) * cell],
  };
}

const cellEl = (x, y) => $('board').children[y * SIZE + x];
const selectedCard = () => state.players[state.turn] && state.players[state.turn].hand[state.selected];

// board と fx を渡すと、その段階の盤を描く（1手の途中の段階を順に見せるため）
function renderBoard(board = state.board, fxList = state.fx, final = true) {
  const fxMap = new Map(fxList.map((f) => [`${f.x},${f.y}`, f]));
  const winSet = new Set((final && state.winLine || []).map(([x, y]) => `${x},${y}`));
  const card = selectedCard();
  const id = card ? effectiveAbility(card, state.turn) : 'plain';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const el = cellEl(x, y);
      const p = board[y][x];
      const key = `${x},${y}`;
      const fx = fxMap.get(key);
      const classes = [];
      let style = '';
      if (fx) classes.push(`fx-${fx.kind}`);
      if (fx && fx.el) classes.push(`fx-el-${fx.el}`);
      if (fx && fx.kind === 'moved') style = `style="--from-x:${fx.fromX - x};--from-y:${fx.fromY - y}"`;
      if (winSet.has(key)) classes.push('is-win');
      el.classList.toggle('is-last', final && !!state.lastMove && state.lastMove[0] === x && state.lastMove[1] === y);
      el.innerHTML = p ? pieceHTML(p, classes.join(' '), style) : '';
      const playable = final && state.phase === 'play' && canPlaceAt(x, y, state.turn, id);
      el.disabled = !playable;
      el.classList.toggle('is-target', playable && !!p);
    }
  }
  $('board').dataset.turn = state.turn;
}

// 能力の効果が届くマス（置く場所そのものは含めない）。プレビューと演出の両方で使う
function areaCells(id, x, y, b) {
  const out = [];
  const mark = (cx, cy) => { if (inside(cx, cy) && (cx !== x || cy !== y)) out.push([cx, cy]); };
  const area = ABILITIES[id] && ABILITIES[id].area;
  if (area === 'ring') for (const [dx, dy] of DIRS8) mark(x + dx, y + dy);
  if (area === 'ring2') for (const [dx, dy] of DIRS8) mark(x + dx * 2, y + dy * 2);
  if (area === 'cross') for (const [dx, dy] of DIRS4) mark(x + dx, y + dy);
  if (area === 'mirror') mark(SIZE - 1 - x, SIZE - 1 - y);
  if (area === 'mirrorH') mark(SIZE - 1 - x, y);
  if (area === 'mirrorV') mark(x, SIZE - 1 - y);
  const R = LINE_BOMB_RANGE;
  if (area === 'row') for (let k = -R; k <= R; k++) mark(x + k, y);
  if (area === 'col') for (let k = -R; k <= R; k++) mark(x, y + k);
  if (area === 'diag') for (let k = -R; k <= R; k++) { mark(x + k, y + k); mark(x + k, y - k); }
  if (area === 'square') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(x + dx, y + dy);
  if (area === 'down') for (let cy = y + 1; inside(x, cy) && !b[cy][x]; cy++) mark(x, cy);
  if (area === 'up') for (let cy = y - 1; inside(x, cy) && !b[cy][x]; cy--) mark(x, cy);
  return out;
}

// 置く前の見た目：置く石の影と、効果の届く範囲
function showPreview(x, y, force = false) {
  clearPreview();
  const card = selectedCard();
  if (state.phase !== 'play' || (state.busy && !force) || !card) return;
  if (!force && notMine(state.turn)) return;
  const id = effectiveAbility(card, state.turn);
  if (!canPlaceAt(x, y, state.turn, id)) return;
  const ab = ABILITIES[id];
  const el = cellEl(x, y);
  const pending = state.pending && state.pending[0] === x && state.pending[1] === y;
  el.insertAdjacentHTML('beforeend', stoneHTML(id === 'spy' ? other(state.turn) : state.turn, id, `is-ghost ${pending ? 'is-pending' : ''}`));
  for (const [cx, cy] of areaCells(id, x, y, state.board)) cellEl(cx, cy).classList.add('in-area');
}

function clearPreview() {
  $('board').querySelectorAll('.is-ghost').forEach((g) => g.remove());
  $('board').querySelectorAll('.in-area').forEach((c) => c.classList.remove('in-area'));
}

function renderPanel(color) {
  const p = state.players[color];
  const myTurn = state.phase === 'play' && state.turn === color;
  const active = myTurn && !notMine(color); // この画面の人が手札を選べるか
  const sealed = state.sealed === color;
  const el = $(`panel-${color}`);
  el.classList.toggle('is-active', myTurn);
  el.classList.toggle('is-cpu', notMine(color));
  // 手番が来たときだけ、手札を一度弾ませる
  const turnKey = `${color}${state.moveCount}`;
  const turnStart = myTurn && state.lastActive !== turnKey;
  if (myTurn) state.lastActive = turnKey;
  el.innerHTML = `
    <div class="player-head">
      <span class="turn-dot turn-${color}"></span>
      <span class="player-name">${playerName(color)}</span>
      <span class="thinking" aria-hidden="true"><i></i><i></i><i></i></span>
      ${sealed ? '<span class="tag">封印中</span>' : ''}
      <span class="bag-info">のこり${piecesLeft(p)}個</span>
    </div>
    <div class="hand ${turnStart ? 'is-turn-start' : ''}" role="radiogroup" aria-label="${COLOR_NAME[color]}の手札">
      ${p.hand.map((c, i) => {
        const ab = ABILITIES[c.ability];
        const cls = ['hand-piece'];
        const selected = myTurn && i === state.selected;
        if (selected) cls.push('is-selected');
        if (sealed && c.ability !== 'plain') cls.push('is-sealed');
        const tipText = sealed && c.ability !== 'plain' ? '封印されていて、ただの石になる' : ab.desc;
        const tip = tipText ? `<span class="hand-tip" role="tooltip"><span class="tip-demo mini"></span><b>${ab.name}</b>${tipText}</span>` : '';
        return `<button type="button" class="${cls.join(' ')}" data-index="${i}" ${active ? '' : 'disabled'} role="radio" aria-checked="${selected}" aria-label="${ab.name}${ab.desc ? `：${ab.desc}` : ''}">
          ${stoneHTML(color, c.ability)}<span class="hand-name">${ab.name}</span>${active ? `<span class="hand-key">${i + 1}</span>` : ''}${tip}
        </button>`;
      }).join('')}
    </div>`;
  el.querySelectorAll('.hand-piece').forEach((c) => {
    c.addEventListener('click', () => selectCard(Number(c.dataset.index)));
    const demo = c.querySelector('.tip-demo');
    const ability = p.hand[Number(c.dataset.index)].ability;
    if (demo && Demo.has(ability) && state.sealed !== color) {
      c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') Demo.start(demo, ability); });
      c.addEventListener('pointerleave', () => { Demo.stop(demo); demo.innerHTML = ''; });
    }
  });
}

function selectCard(i) {
  // 演出の途中でも選べる（先行入力）。CPU の番は選べない
  if (state.phase !== 'play' || notMine(state.turn) || state.cpuThinking) return;
  if (i < 0 || i >= state.players[state.turn].hand.length) return;
  if (state.selected !== i) Sound.select();
  state.selected = i;
  renderPanel(state.turn);
  if (!state.busy) renderBoard();
  renderStatus();
  if (state.pending) showPreview(...state.pending);
  drawQueued();
}

function renderStatus() {
  const status = $('game-status');
  if (state.phase === 'end') {
    status.innerHTML = `<span class="status-text">${state.winner ? `${playerName(state.winner)}の勝ち` : '引き分け'}</span>`
      + '<button type="button" class="btn-primary btn-small" id="again-inline">もう一局</button>';
    $('again-inline').addEventListener('click', () => (state.mode === 'online' ? backToTitle(true) : startDraft()));
  } else {
    status.innerHTML = `<span class="turn-dot turn-${state.turn}"></span><span class="status-text">${playerName(state.turn)}の番</span>`;
  }
}

function renderGame() {
  renderBoard();
  renderPanel('w');
  renderPanel('b');
  renderStatus();
}

function renderLog() {
  const el = $('log');
  if (el) el.innerHTML = state.logs.map((t) => `<li>${t}</li>`).join('');
}

// タッチでは、1回目のタップで場所を選び、同じマスをもう一度タップして置く
function onCellTap(x, y, pointerType) {
  const card = selectedCard();
  if (state.phase !== 'play' || !card || notMine(state.turn) || state.cpuThinking) return;
  if (!canPlaceAt(x, y, state.turn, effectiveAbility(card, state.turn))) return;
  // 演出の途中なら予約する（先行入力）。同じマスをもう一度押すと取り消し
  if (state.busy) {
    const same = state.queued && state.queued[0] === x && state.queued[1] === y;
    state.queued = same ? null : [x, y];
    drawQueued();
    return;
  }
  if (pointerType === 'touch' || pointerType === 'pen') {
    const same = state.pending && state.pending[0] === x && state.pending[1] === y;
    if (!same) {
      state.pending = [x, y];
      showPreview(x, y);
      return;
    }
  }
  state.pending = null;
  clearPreview();
  place(x, y);
}

async function place(x, y, remote = false) {
  const color = state.turn;
  const sent = selectedCard();
  if (state.mode === 'online' && !remote && sent) Net.send('move', { id: sent.id, x, y });
  const res = playMove(x, y);
  if (!res.ok) return;
  state.busy = true;
  renderPanel('w');
  renderPanel('b');
  renderStatus();
  const special = !HIDDEN_IDS.includes(res.ability);
  const banner = special ? showBanner(res.ability, color) : null;
  const t = boardTarget();
  const area = special ? areaCells(res.ability, x, y, res.before) : [];
  Sound.place();
  if (!special) res.steps[0].fx[0].el = 'plain'; // ただの石も、着いて少し震える
  // 予兆：置いただけの盤を見せ、石をためる（届く範囲に点線の枠）
  if (special) {
    renderBoard(res.before, [{ kind: 'placed', x, y }], false);
    const st = cellEl(x, y).querySelector('.stone');
    if (st) st.classList.add('is-charging');
    FX.anticipate(t, res.ability, x, y, { area });
    Sound.charge(FX.elementOf(res.ability), FX.anticipationOf(res.ability));
    await sleep(FX.anticipationOf(res.ability) * 1000);
    Sound.ability(res.ability);
  }
  // 衝撃 → 重力 → 囲碁・地雷、と段階ごとに盤を描き、音を鳴らす
  for (let i = 0; i < res.steps.length; i++) {
    const last = i === res.steps.length - 1;
    // 予兆で見せた石は、もう一度落とさない
    renderBoard(res.steps[i].board, i === 0 && special ? res.steps[0].fx.slice(1) : res.steps[i].fx, last);
    if (i === 0 && special) FX.burst(t, res.ability, x, y, { fx: res.steps[0].fx, area });
    else if (i === 0) { FX.plain(t, x, y, color); FX.after(t, res.steps[0].fx.slice(1), res.steps[0].board, { origin: [x, y] }); }
    else FX.after(t, res.steps[i].fx, res.steps[i].board);
    drawQueued();
    Sound.fx(i === 0 ? res.steps[0].fx.slice(1) : res.steps[i].fx, i === 0 ? 0.1 : 0);
    // 予約があれば、段階の間を短くして早く返す
    if (!last) await sleep(state.queued ? 160 : STEP_MS);
  }
  if (banner && !state.queued) await banner;
  if (res.extraTurn && !res.winner && state.phase === 'play' && state.turn === color && !state.queued) await showBanner(null, color, 'もう1回');
  state.busy = false;
  state.fx = [];
  renderGame();
  if (state.phase === 'end') { state.queued = null; showResult(color); return; }
  // 予約した手を置く（盤が変わって置けなくなっていたら取り消す）
  const q = state.queued;
  state.queued = null;
  const card = selectedCard();
  if (q && card && !notMine(state.turn) && canPlaceAt(q[0], q[1], state.turn, effectiveAbility(card, state.turn))) { place(q[0], q[1]); return; }
  if (runRemoteQueue()) return;
  maybeCpuMove();
}

// ===== オンライン対戦：相手から届いた手 =====
// 演出の途中に届いた手は、ためておいて、手が空いてから順に進める
function onRemote(type, data) {
  state.remoteQueue = state.remoteQueue || [];
  state.remoteQueue.push({ type, data });
  if (!state.busy) runRemoteQueue();
}
function runRemoteQueue() {
  const q = state.remoteQueue;
  if (!q || !q.length || state.busy) return false;
  const { type, data } = q.shift();
  if (type === 'pick' && state.phase === 'draft' && isRemote(draftColor())) { pickDraft(data.id, true); return true; }
  if (type === 'move' && state.phase === 'play' && isRemote(state.turn)) {
    const i = state.players[state.turn].hand.findIndex((c) => c.id === data.id);
    if (i >= 0) { state.selected = i; place(data.x, data.y, true); return true; }
  }
  return runRemoteQueue();
}

// 予約したマスに、脈打つ影を出す
function drawQueued() {
  $('board').querySelectorAll('.is-queued').forEach((g) => g.remove());
  const q = state.queued;
  const card = selectedCard();
  if (!q || !card) return;
  const id = effectiveAbility(card, state.turn);
  cellEl(q[0], q[1]).insertAdjacentHTML('beforeend', stoneHTML(id === 'spy' ? other(state.turn) : state.turn, id, 'is-ghost is-pending is-queued'));
}

function showBanner(ability, color, text) {
  return new Promise((resolve) => {
    const b = $('banner');
    b.innerHTML = ability ? `${iconHTML(ability)}${ABILITIES[ability].name}` : text;
    b.className = `banner banner-${color}`;
    b.hidden = false;
    void b.offsetWidth; // アニメーションを毎回かけ直す
    b.classList.add('is-show');
    setTimeout(() => { b.hidden = true; b.classList.remove('is-show'); resolve(); }, BANNER_MS);
  });
}

function showResult(mover) {
  let text, sub;
  if (!state.winner) {
    text = '引き分け';
    sub = state.board.every((row) => row.every(Boolean)) ? '盤が埋まった' : '碁石を使い切った';
  } else {
    text = `${playerName(state.winner)}の勝ち`;
    const line = state.winLine.map(([x, y]) => state.board[y][x]);
    if (line.some((p) => p.ability === 'spy' && p.owner === state.winner && p.color !== state.winner)) sub = 'スパイが効いた';
    else if (state.winner !== mover) sub = `${playerName(mover)}が${playerName(state.winner)}の列をつくってしまった`;
    else if (state.winKind === 'flag') sub = '旗のまわりを囲んだ';
    else if (state.winKind === 'square') sub = '結束の正方形ができた';
    else if (line.some((p) => p.ability === 'joker' && p.color !== state.winner)) sub = '相手のジョーカーで揃った';
    else sub = `${state.moveCount}手目で決着`;
  }
  $('result-text').textContent = text;
  $('result-sub').textContent = sub;
  const happy = state.winner && !notMine(state.winner);
  if (happy) Sound.win(); else Sound.lose();
  $('result-dialog').showModal();
}

function renderRules() {
  $('rules-types').textContent = `超能力の碁石は${SPECIAL_IDS.length}種類。毎回そのうち${DRAFT_POOL_SIZE}種類が1つずつ出てくる。`;
  $('ability-list').innerHTML = SPECIAL_IDS.map((id) => {
    const ab = ABILITIES[id];
    return `<dt>${stoneHTML('b', id)}${ab.name}</dt><dd>${ab.desc}</dd>`;
  }).join('');
}

// ===== オンライン対戦：相手をさがして、始める =====
// 知らない人と当たる。ロビーで相手が見つかったら、ホスト（誘った側）が種と色を決めて送る
async function startOnline() {
  state.phase = 'online';
  state.mode = 'online';
  showScreen('online');
  $('online-title').textContent = '対戦相手をさがしています';
  $('online-sub').textContent = 'つないでいます…';
  try {
    const { isHost } = await Net.find((n) => {
      $('online-sub').textContent = n > 0 ? `いま、ほかに ${n}人がさがしています` : 'ほかにさがしている人を待っています';
    });
    if (state.phase !== 'online') return; // やめるが押された
    $('online-title').textContent = '見つかりました！';
    $('online-sub').textContent = '';
    if (isHost) {
      const seed = newSeed();
      const myColor = Math.random() < 0.5 ? 'b' : 'w';
      Net.send('start', { seed, guestColor: other(myColor) });
      beginOnline(seed, myColor);
    } else {
      Net.once('start', (d) => beginOnline(d.seed, d.guestColor));
    }
  } catch (err) {
    if (state.phase !== 'online') return;
    $('online-title').textContent = 'つながりませんでした';
    $('online-sub').textContent = 'もう一度、タイトルからためしてください';
  }
}

function beginOnline(seed, myColor) {
  if (state.phase !== 'online') return;
  state.myColor = myColor;
  setTimeout(() => startDraft('online', seed), 500);
}

// 左上の名前を押すと、タイトルに戻る。対局の途中なら、確かめてから
function backToTitle(force = false) {
  if (state.phase === 'title') return;
  if (!force && state.phase === 'play' && !window.confirm('対局の途中です。タイトルに戻りますか？')) return;
  if (state.mode === 'online' || state.phase === 'online') Net.leave();
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  Demo.stopAll();
  state.phase = 'title';
  state.busy = false;
  state.queued = null;
  state.pending = null;
  showScreen('title');
}

// 押したボタンが画面いっぱいに広がり、そのあいだに次の画面へ切り替えて、色が抜けていく
function expandThen(btn, next) {
  if (state.expanding) return;
  // OS の「視差効果を減らす」がオンでも見せる（ほかの演出と同じ扱い。短い1回きりの動き）
  state.expanding = true;
  const r = btn.getBoundingClientRect();
  const cover = document.createElement('div');
  cover.className = 'expander';
  cover.style.background = getComputedStyle(btn).backgroundColor;
  cover.innerHTML = `<span>${(btn.querySelector('.mode-label') || btn).textContent.trim()}</span>`;
  document.body.appendChild(cover);
  Sound.whoosh();
  const from = { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: `${r.height / 2}px` };
  const to = { left: '0px', top: '0px', width: `${innerWidth}px`, height: `${innerHeight}px`, borderRadius: '0px' };
  cover.querySelector('span').animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  cover.animate([from, to], { duration: 280, easing: 'cubic-bezier(0.6, 0, 0.2, 1)', fill: 'forwards' }).onfinish = () => {
    next();
    cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => {
      cover.remove();
      state.expanding = false;
    };
  };
}

// タイトルの背景：アイソメトリック（斜め上から見た）の五目並べの盤。画面からはみ出す大きさで置く
function renderTitleArt() {
  const W = 64, H = 32, T = 26; // マスの幅・高さ（2:1）、盤の厚み
  const P = (i, j) => [(i - j) * W / 2, (i + j) * H / 2];
  const pt = (i, j) => P(i, j).join(',');
  const e = -0.7, f = SIZE - 1 + 0.7;
  const parts = [];
  // 盤の側面と上面
  const [rx, ry] = P(f, e), [bx, by] = P(f, f), [lx, ly] = P(e, f);
  parts.push(`<polygon class="art-side-r" points="${rx},${ry} ${bx},${by} ${bx},${by + T} ${rx},${ry + T}"/>`);
  parts.push(`<polygon class="art-side-l" points="${lx},${ly} ${bx},${by} ${bx},${by + T} ${lx},${ly + T}"/>`);
  parts.push(`<polygon class="art-top" points="${pt(e, e)} ${pt(f, e)} ${pt(f, f)} ${pt(e, f)}"/>`);
  // 線
  for (let k = 0; k < SIZE; k++) {
    parts.push(`<line class="art-line" x1="${P(k, 0)[0]}" y1="${P(k, 0)[1]}" x2="${P(k, SIZE - 1)[0]}" y2="${P(k, SIZE - 1)[1]}"/>`);
    parts.push(`<line class="art-line" x1="${P(0, k)[0]}" y1="${P(0, k)[1]}" x2="${P(SIZE - 1, k)[0]}" y2="${P(SIZE - 1, k)[1]}"/>`);
  }
  // 石（奥から手前の順に描く）。いくつかには超能力のアイコンを、盤に寝かせて描く
  const stones = [
    [1, 2, 'w'], [2, 1, 'b'], [2, 3, 'b', 'gravity'], [3, 2, 'w'], [3, 3, 'b'], [1, 5, 'w', 'spin'], [4, 2, 'b'],
    [4, 4, 'b'], [5, 1, 'w', 'bomb'], [3, 5, 'w'], [5, 5, 'b'], [4, 6, 'w'], [6, 3, 'w', 'joker'], [6, 6, 'b', 'go'],
    [2, 6, 'b'], [7, 2, 'b', 'push'], [5, 7, 'w'], [7, 5, 'w'], [8, 4, 'b', 'shield'], [3, 8, 'w', 'antigravity'],
  ].sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  // 碁石は上下がふくらんだ回転楕円体。斜め上から見ると、少し厚みのある楕円に見える。
  // 平たい円柱（オセロの石）に見えないよう、側面は描かず、光の当たり方（グラデーション）で丸みを出し、盤に影を落とす
  const R = W * 0.37;
  for (const [i, j, c, icon] of stones) {
    const [x, y] = P(i, j);
    const lift = R * 0.2; // ふくらんだぶん、中心が盤より少し上にある
    parts.push(`<ellipse class="art-shadow" cx="${x + 3}" cy="${y + 3}" rx="${R * 1.02}" ry="${R * 0.5}"/>`);
    parts.push(`<ellipse fill="url(#art-stone-${c})" class="art-stone-${c}" cx="${x}" cy="${y - lift}" rx="${R}" ry="${R * 0.64}"/>`);
    if (icon) parts.push(`<g class="art-icon-${c}" transform="translate(${x},${y - lift * 1.4}) scale(1,0.5) rotate(45) scale(1.1) translate(-12,-12)">${ICONS[icon]}</g>`);
  }
  const defs = `<defs>
    <radialGradient id="art-stone-b" cx="0.36" cy="0.3" r="0.75"><stop offset="0" stop-color="#6a6560"/><stop offset="0.45" stop-color="#2a2724"/><stop offset="1" stop-color="#0d0c0b"/></radialGradient>
    <radialGradient id="art-stone-w" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f4f0e8"/><stop offset="1" stop-color="#c9c1b2"/></radialGradient>
  </defs>`;
  const [, maxY] = P(f, f);
  $('title-art').innerHTML = `<svg viewBox="${P(e, f)[0] - 8} ${P(e, e)[1] - 40} ${P(f, e)[0] - P(e, f)[0] + 16} ${maxY + T + 50}" aria-hidden="true">${defs}${parts.join('')}</svg>`;
}

function onKey(e) {
  if (document.querySelector('dialog[open]')) return;
  if (state.phase === 'play' && ['1', '2', '3'].includes(e.key)) selectCard(Number(e.key) - 1);
  if (e.key === 'Escape' && state.pending) { state.pending = null; clearPreview(); }
}

function init() {
  if (!$('start-pvp')) return; // ゲームの画面がないページ（比較ページなど）では、初期化しない
  renderRules();
  $('logo-btn').addEventListener('click', backToTitle);
  $('start-pvp').addEventListener('click', (e) => expandThen(e.currentTarget, () => startDraft('pvp')));
  $('start-cpu').addEventListener('click', (e) => expandThen(e.currentTarget, () => startDraft('cpu')));
  $('start-online').addEventListener('click', (e) => expandThen(e.currentTarget, startOnline));
  $('online-cancel').addEventListener('click', () => { Net.leave(); state.phase = 'title'; showScreen('title'); });
  Net.on('pick', (d) => onRemote('pick', d));
  Net.on('move', (d) => onRemote('move', d));
  Net.onLeave(() => {
    if (state.mode !== 'online' || (state.phase !== 'draft' && state.phase !== 'play')) return;
    state.phase = 'end';
    state.busy = false;
    $('result-text').textContent = '接続が切れました';
    $('result-sub').textContent = '相手との接続が切れました';
    $('result-dialog').showModal();
  });
  $('again-btn').addEventListener('click', () => (state.mode === 'online' ? backToTitle(true) : startDraft()));
  renderTitleArt();
  $('look-btn').addEventListener('click', () => $('result-dialog').close());
  $('rules-btn').addEventListener('click', () => $('rules-dialog').showModal());
  $('log-btn').addEventListener('click', () => $('log-dialog').showModal());
  const soundBtn = $('sound-btn');
  const renderSoundBtn = () => { soundBtn.classList.toggle('is-muted', Sound.muted); soundBtn.setAttribute('aria-pressed', String(!Sound.muted)); };
  soundBtn.addEventListener('click', () => { Sound.setMuted(!Sound.muted); renderSoundBtn(); });
  renderSoundBtn();
  // ダイアログの外側（中身の枠より外）を押したら閉じる
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  document.addEventListener('keydown', onKey);
  // 盤の外をタップしたら、選んでいたマスを取り消す
  document.addEventListener('pointerdown', (e) => {
    if (state.pending && !e.target.closest('.board') && !e.target.closest('.hand')) {
      state.pending = null; clearPreview();
    }
  });
  showScreen('title');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
if (typeof module !== 'undefined') {
  module.exports = {
    setSeed, SIZE, ABILITIES, ICONS, SPECIAL_IDS, DRAFT_POOL_SIZE, DRAFT_ORDER, LINE_DIRS,
    findWin, specialWin, lineOwner, countsFor, growth, newBoard, newPiece, playMove, resolvePlacement, snapshot, areaCells, settle, goTraps, mineCheck,
    state, makePlayer, makeCard, makeDraftPool, effectiveAbility, canPlaceAt, inside, other, shuffle,
  };
}
