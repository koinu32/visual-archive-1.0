# 视觉档案馆 — AI Visual Archive

基于视觉风格的个人灵感档案馆。AI 自动分析媒介与风格,结构化反推 Prompt,永久保存。

## 本地运行

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 http://localhost:3000

`.env.local` 中填入火山方舟/豆包 API Key:

```bash
DOUBAO_API_KEY=你的火山方舟 API Key
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
DOUBAO_MODEL=doubao-1.5-vision-pro-32k-250115
```

应用默认通过服务端 `/api/vision` 调用豆包视觉模型,Key 不会暴露到浏览器。

## 部署到 Vercel

1. 把这个项目推到 GitHub
2. 去 vercel.com 用 GitHub 登录
3. Import 这个仓库
4. 点 Deploy,完成

## 技术栈

- Next.js 14
- Supabase (数据库 + 图片存储)
- 豆包大模型 / 火山方舟 API (AI 分析)
