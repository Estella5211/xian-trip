// Cloudflare Worker： serving the static handbook + 云端同步(KV)
// 同步接口：GET/POST /api/data?pass=xxx
//   GET  -> { todos:[], costs:[], updated:number }
//   POST -> body { pass, data:{todos,costs,updated} }  -> { ok:true }
// 数据按 pass(旅行口令) 分桶，两部手机输入同一口令即互通。

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS（页面与接口同源时无用，但允许 file:// 打开也能同步）
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (path === "/api/data") {
      const pass = url.searchParams.get("pass") || "";
      if (!pass) return json({ error: "missing pass" }, 400, cors);

      if (request.method === "GET") {
        const v = await env.TRIP_KV.get(pass);
        return json(v ? JSON.parse(v) : { todos: [], costs: [], updated: 0 }, 200, cors);
      }
      if (request.method === "POST") {
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400, cors); }
        const data = body.data || {};
        data.updated = Date.now();
        await env.TRIP_KV.put(pass, JSON.stringify(data));
        return json({ ok: true, updated: data.updated }, 200, cors);
      }
      return json({ error: "method" }, 405, cors);
    }

    // 其余请求：交给静态资源（index.html 等）
    return env.ASSETS.fetch(request);
  },
};

function json(o, status = 200, extra = {}) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}
