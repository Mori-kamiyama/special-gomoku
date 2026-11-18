// オンライン対戦の通信。Trystero（サーバーなしの WebRTC。相手さがしは Nostr の公開ネットワークを使う）
//   Net.find(onCount) … 知らない人と当たる。見つかったら { isHost } を返す（誘った側がホスト）
//   Net.send(type, data) / Net.on(type, fn) / Net.once(type, fn) … 相手との手のやり取り
//   Net.onLeave(fn) … 相手との接続が切れたとき
//   Net.leave() … やめる（ロビーと対戦の部屋から抜ける）
// 相手さがし：ロビーにいる人を ID の順に並べ、自分より ID が大きい空いている人だけを誘う（同時に誘い合わない）。
// 誘いを受けた人は、誰も誘っていなければ受ける。決まったら、2人だけの部屋に移る。
// 直接つながらない回線（全体の2割くらい）のために、無料の TURN サーバー（Open Relay）を保険に使う。
// 通信のつなぎ方を Firebase などに替えるときは、このファイルだけを書き換える。
(function () {
  const APP_ID = 'special-gomoku-v1';
  const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.21.6/+esm';
  const TURN = [{
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  }];
  const CONFIG = { appId: APP_ID, turnConfig: TURN };
  const MATCH_TIMEOUT_MS = 15000; // 部屋を移ってから相手が来るまで待つ時間

  let lib = null;
  let lobby = null, match = null, timer = null;
  let sendMsg = null;
  const handlers = {};   // type → [fn]
  const pending = {};    // 受け取る人がまだいない手（type → [data]）
  let leaveFn = null;
  let partner = null;

  async function load() {
    if (!lib) lib = await import(TRYSTERO_URL);
    return lib;
  }

  function deliver(type, data) {
    const list = handlers[type];
    if (list && list.length) list.slice().forEach((fn) => fn(data));
    else (pending[type] = pending[type] || []).push(data);
  }

  function cleanup() {
    clearInterval(timer); timer = null;
    try { if (lobby) lobby.leave(); } catch (e) { /* すでに抜けている */ }
    try { if (match) match.leave(); } catch (e) { /* すでに抜けている */ }
    lobby = null; match = null; sendMsg = null; partner = null;
    for (const k of Object.keys(pending)) delete pending[k];
  }

  const Net = {
    async find(onCount = () => {}) {
      cleanup();
      const { joinRoom, selfId } = await load();
      lobby = joinRoom(CONFIG, 'lobby');
      const [sendInvite, getInvite] = lobby.makeAction('invite');
      const [sendAnswer, getAnswer] = lobby.makeAction('answer');
      const [sendBusy, getBusy] = lobby.makeAction('busy');
      const peers = new Set(), busy = new Set();
      let engaged = false, inviting = null;
      onCount(0);

      return new Promise((resolve, reject) => {
        const myLobby = lobby;
        lobby.onPeerJoin((id) => { peers.add(id); onCount(peers.size); });
        lobby.onPeerLeave((id) => { peers.delete(id); busy.delete(id); if (inviting === id) inviting = null; onCount(peers.size); });
        getBusy((_, from) => busy.add(from));

        // 自分より ID が大きい、空いている人を誘う
        const tryInvite = () => {
          if (engaged || inviting || lobby !== myLobby) return;
          const target = [...peers].filter((p) => !busy.has(p) && p > selfId).sort()[0];
          if (!target) return;
          inviting = target;
          sendInvite({}, target);
          setTimeout(() => { if (inviting === target && !engaged) inviting = null; }, 3000);
        };
        timer = setInterval(tryInvite, 700);

        getInvite((_, from) => {
          if (engaged || inviting) { sendAnswer({ ok: false }, from); return; }
          engaged = true;
          sendAnswer({ ok: true }, from);
          go(from, false);
        });
        getAnswer((d, from) => {
          if (from !== inviting) return;
          inviting = null;
          if (d.ok && !engaged) { engaged = true; go(from, true); }
        });

        // 2人だけの部屋に移る
        function go(other, isHost) {
          clearInterval(timer); timer = null;
          sendBusy({});
          partner = other;
          const roomId = isHost ? `m-${selfId}-${other}` : `m-${other}-${selfId}`;
          setTimeout(() => { try { myLobby.leave(); } catch (e) { /* すでに抜けている */ } if (lobby === myLobby) lobby = null; }, 800);
          match = joinRoom(CONFIG, roomId);
          const [send, get] = match.makeAction('msg');
          sendMsg = send;
          get((m, from) => { if (from === partner) deliver(m.t, m.d); });
          let joined = false;
          const giveUp = setTimeout(() => { if (!joined) { cleanup(); reject(new Error('timeout')); } }, MATCH_TIMEOUT_MS);
          match.onPeerJoin((id) => {
            if (id !== partner || joined) return;
            joined = true;
            clearTimeout(giveUp);
            resolve({ isHost });
          });
          match.onPeerLeave((id) => { if (id === partner && leaveFn) leaveFn(); });
        }
      });
    },
    send(type, data) {
      if (sendMsg && partner) sendMsg({ t: type, d: data }, partner);
    },
    on(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
      const waiting = pending[type];
      if (waiting) { delete pending[type]; waiting.forEach((d) => fn(d)); }
    },
    once(type, fn) {
      const wrap = (d) => { handlers[type] = handlers[type].filter((f) => f !== wrap); fn(d); };
      Net.on(type, wrap);
    },
    onLeave(fn) { leaveFn = fn; },
    leave() { cleanup(); },
  };
  window.Net = Net;
})();
