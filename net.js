// オンライン対戦の通信。Trystero（サーバーなしの WebRTC。相手さがしは Nostr の公開ネットワークを使う）
//   Net.find(onCount, word, rulesVersion) … 知らない人と当たる。見つかったら { isHost } を返す（誘った側がホスト）
//   Net.send(type, data) / Net.on(type, fn) / Net.once(type, fn) … 相手との手のやり取り
//   Net.onLeave(fn) … 相手との接続が切れたとき
//   Net.finish() … 対局が終わったら、相手側の結果が確定するのを待って切断する
//   Net.leave() … やめる（ロビーと対戦の部屋から抜ける）
// 相手さがし：ロビーにいる人を ID の順に並べ、自分より ID が大きい空いている人だけを誘う（同時に誘い合わない）。
// 誘いを受けた人は、誰も誘っていなければ受ける。決まったら、2人だけの部屋に移る。
// 直接つながらない回線のために、TURN サーバー（Cloudflare）を使う。鍵は turn-worker/ の Worker が配る。
// 通信のつなぎ方を Firebase などに替えるときは、このファイルだけを書き換える。
(function () {
  const APP_ID = 'special-gomoku-v1';
  const TRYSTERO_URL = 'https://cdn.jsdelivr.net/npm/trystero@0.21.6/+esm';
  // STUN は使わない。UDP の STUN や TURN は、使えない回線（VPN や別の LAN）があると、つなぎ先を「集め終わる」までに
  // 15秒以上かかり、Trystero はその間ずっと待ってしまう（Mac と mameta で確かめた）。TCP の TURN だけなら0.1〜0.5秒で集め終わる
  const STUN = [];
  // TURN（直接つながらない回線のための中継）。鍵は Worker（turn-worker/）からもらう（Worker が Metered に取りに行く）。
  // 同じ LAN でも、ブラウザがローカルのアドレスを隠すので、直接はつながらないことが多い。TURN は必須
  const TURN_ENDPOINT = 'https://special-gomoku-turn.uemnan.workers.dev/ice';
  let iceServers = STUN;
  async function loadIce() {
    if (!TURN_ENDPOINT || iceServers !== STUN) return;
    try {
      const r = await fetch(TURN_ENDPOINT);
      const { iceServers: turn } = await r.json();
      // TURN は TCP の2つだけ：80番の TCP と、443番の TLS（会社や学校の回線でも通りやすい）。UDP は上の理由で使わない
      const relay = (turn || []).map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => u.startsWith('turn')) })).filter((s) => s.urls.length);
      const pickOne = (re) => {
        const server = relay.find((s) => s.urls.some((u) => re.test(u)));
        return server && { ...server, urls: server.urls.find((u) => re.test(u)) };
      };
      const chosen = [pickOne(/^turn:.*transport=tcp/), pickOne(/^turns:/)].filter(Boolean);
      if (chosen.length) iceServers = STUN.concat(chosen);
    } catch (e) { /* 取れなければ、同じ機械の中どうしだけつながる */ }
  }
  const config = (rulesVersion) => ({ appId: `${APP_ID}-rules-${rulesVersion}`, rtcConfig: { iceServers } });
  const MATCH_TIMEOUT_MS = 15000; // 部屋を移ってから相手が来るまで待つ時間
  const FINISH_TIMEOUT_MS = 8000; // 終了通知に対応していない相手でも、結果画面にいる間はつなぎ続けない

  let lib = null;
  let lobby = null, match = null, timer = null;
  let matchTimer = null, finishTimer = null;
  let searchId = 0;
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

  // あいことばから部屋の名前を作る（あいことばそのものは、部屋の名前に出さない）
  function hash(text) {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function cleanup() {
    searchId++;
    clearInterval(timer); timer = null;
    clearTimeout(matchTimer); matchTimer = null;
    clearTimeout(finishTimer); finishTimer = null;
    const rooms = [lobby, match];
    lobby = null; match = null; sendMsg = null; partner = null;
    for (const room of rooms) {
      try { room?.leave(); } catch (e) { /* すでに抜けている */ }
    }
    for (const k of Object.keys(pending)) delete pending[k];
  }

  const Net = {
    // word（あいことば）を渡すと、同じあいことばの人だけが集まる部屋で相手をさがす（あいことばで中身も暗号にする）
    async find(onCount = () => {}, word = '', rulesVersion = 1) {
      cleanup();
      const id = searchId;
      const { joinRoom, selfId } = await load();
      if (searchId === id) await loadIce();
      if (searchId !== id) throw new DOMException('相手さがしを中止しました', 'AbortError');
      const roomConfig = config(rulesVersion);
      lobby = word ? joinRoom({ ...roomConfig, password: word }, `room-${hash(word)}`) : joinRoom(roomConfig, 'lobby');
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
          if (lobby !== myLobby) return;
          if (engaged || inviting) { sendAnswer({ ok: false }, from); return; }
          engaged = true;
          sendAnswer({ ok: true }, from);
          go(from, false);
        });
        getAnswer((d, from) => {
          if (lobby !== myLobby || from !== inviting) return;
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
          const myMatch = match = joinRoom(roomConfig, roomId);
          const [send, get] = myMatch.makeAction('msg');
          sendMsg = send;
          get((m, from) => {
            if (match !== myMatch || from !== partner) return;
            if (m.t === 'finish') {
              if (finishTimer !== null) cleanup();
              return;
            }
            deliver(m.t, m.d);
          });
          let joined = false;
          matchTimer = setTimeout(() => {
            cleanup();
            reject(new Error('timeout'));
          }, MATCH_TIMEOUT_MS);
          myMatch.onPeerJoin((id) => {
            if (match !== myMatch || id !== partner || joined) return;
            joined = true;
            clearTimeout(matchTimer); matchTimer = null;
            resolve({ isHost });
          });
          myMatch.onPeerLeave((id) => {
            if (match !== myMatch || id !== partner || !joined) return;
            const finished = finishTimer !== null;
            cleanup();
            if (!finished && leaveFn) leaveFn();
          });
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
    finish() {
      if (!sendMsg || !partner || finishTimer !== null) return;
      // 最後の手と同じ順序付きチャンネルで送り、双方が結果を表示できるまで待つ。
      finishTimer = setTimeout(cleanup, FINISH_TIMEOUT_MS);
      sendMsg({ t: 'finish', d: null }, partner).catch(() => {});
    },
    leave() { cleanup(); },
  };
  window.Net = Net;
})();
