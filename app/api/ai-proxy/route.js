// app/api/ai-proxy/route.js
// 服务端代理:浏览器请求发到这里,由 Vercel 服务端转发到目标 API,绕过 CORS。
// v2: 改用 Node.js runtime + 拉长超时 + 自动重试,提高国内接口连通性。

export const runtime = "nodejs";   // Edge 改 Node,对国内接口连通性更好
export const maxDuration = 60;     // Pro 计划生效;Hobby 计划上限 10s,会被强制截断但不影响功能

export async function POST(req) {
  try {
    const { url, headers, body } = await req.json();
    if (!url) {
      return json({ error: { message: "缺少 url 参数" } }, 400);
    }

    // 自动重试:网络抖动时再试 2 次
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(headers || {}) },
          body: typeof body === "string" ? body : JSON.stringify(body),
        });
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { _raw: text }; }
        return json(data, r.status);
      } catch (e) {
        lastErr = e;
        const msg = e?.message || String(e);
        const retriable = /network|fetch failed|ECONNRESET|ETIMEDOUT|socket|connection/i.test(msg);
        if (!retriable || attempt === 3) break;
        await new Promise(res => setTimeout(res, 600 * attempt));
      }
    }
    return json({
      error: {
        message: "代理转发失败(已重试 3 次): " + (lastErr?.message || "未知错误") +
          "。若持续失败,可能是 Vercel 节点到目标接口的网络不通,建议换 Claude/GPT/Gemini,或把项目部署到国内云。"
      }
    }, 502);
  } catch (e) {
    return json({ error: { message: "代理路由内部错误: " + (e?.message || String(e)) } }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
