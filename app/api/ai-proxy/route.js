// app/api/ai-proxy/route.js
// 服务端代理:浏览器请求发到这里,由 Vercel 服务端转发到目标 API,绕过 CORS。
// 客户端 POST 体: { url, headers, body }
//   - url:    目标完整 endpoint(已含 query string,如 gemini 的 ?key=)
//   - headers: 转发请求头(含鉴权 token)
//   - body:   请求体(对象或字符串)

export const runtime = "edge"; // Edge runtime 启动更快,Vercel 免费档够用

export async function POST(req) {
  try {
    const { url, headers, body } = await req.json();
    if (!url) {
      return json({ error: { message: "缺少 url 参数" } }, 400);
    }
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await r.text();
    // 目标响应通常是 JSON;若非 JSON,包成 { _raw: ... } 透传
    let data;
    try { data = JSON.parse(text); } catch { data = { _raw: text }; }
    return json(data, r.status);
  } catch (e) {
    return json({ error: { message: "代理转发失败: " + (e?.message || String(e)) } }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
