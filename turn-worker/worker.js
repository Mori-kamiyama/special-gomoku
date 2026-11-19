// 中継サーバー（TURN）の鍵を配る小さなサーバー（Cloudflare Workers。Workers の無料プランはカードなしで使える）。
// ゲームのページが GET /ice を呼ぶと、1時間だけ使える TURN の情報を返す。
// 本物の鍵（METERED_APP と METERED_KEY、または TURN_KEY_ID と TURN_KEY_API_TOKEN）は、ここに置いたまま外に出さない。
// 鍵は、Cloudflare の画面の Workers → special-gomoku-turn → Settings → Variables and Secrets に Secret として入れる。
const ALLOWED = ['https://new-umechan.github.io', 'http://localhost:8765'];
const TTL = 3600; // 鍵が使える秒数

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'GET',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname !== '/ice') return new Response('not found', { status: 404, headers: cors });
    // ほかのサイトから使われないように、ゲームのページからの呼び出しだけに答える
    if (origin && !ALLOWED.includes(origin)) return new Response('forbidden', { status: 403, headers: cors });

    // 中継サーバーは2種類に対応する。Metered（カードなしの無料プラン）か、Cloudflare Realtime（カードの登録が要る）
    let data;
    if (env.METERED_APP && env.METERED_KEY) {
      const res = await fetch(`https://${env.METERED_APP}.metered.live/api/v1/turn/credentials?apiKey=${env.METERED_KEY}`);
      if (!res.ok) return new Response('turn error', { status: 502, headers: cors });
      data = { iceServers: await res.json() };
    } else {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL }),
      });
      if (!res.ok) return new Response('turn error', { status: 502, headers: cors });
      data = await res.json();
    }
    // ポート53は、ブラウザが止めることが多いので外す
    const servers = (data.iceServers || []).map((s) => ({
      ...s,
      urls: [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)),
    })).filter((s) => s.urls.length);
    return new Response(JSON.stringify({ iceServers: servers }), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};
