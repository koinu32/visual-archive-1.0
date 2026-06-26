export const runtime = "nodejs";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const DEFAULT_MODEL = "doubao-1.5-vision-pro-32k-250115";

export async function POST(request) {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "服务端缺少 DOUBAO_API_KEY,请在 .env.local 或 Vercel 环境变量中配置。" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.base64 || !body?.systemText) {
    return Response.json({ error: "请求缺少 base64 或 systemText。" }, { status: 400 });
  }

  const mediaType = body.mediaType || "image/jpeg";
  const model = body.model || process.env.DOUBAO_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.DOUBAO_BASE_URL || DEFAULT_BASE_URL;

  const upstream = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: body.max_tokens || 700,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: body.systemText },
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${body.base64}` } },
          ],
        },
      ],
    }),
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data.error) {
    return Response.json(
      { error: data.error?.message || data.error || `豆包 API 请求失败: HTTP ${upstream.status}` },
      { status: upstream.status || 500 },
    );
  }

  return Response.json({ content: data.choices?.[0]?.message?.content || "" });
}
