# 视觉档案馆 — AI Visual Archive

基于视觉风格的个人灵感档案馆。AI 自动分析媒介与风格,结构化反推 Prompt,永久保存。

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000

## 部署到 Vercel

1. 把这个项目推到 GitHub
2. 去 vercel.com 用 GitHub 登录
3. Import 这个仓库
4. 点 Deploy,完成

## 技术栈

- Next.js 14
- Supabase (数据库 + 图片存储)
- Claude Vision API (AI 分析)
