import "./globals.css";

export const metadata = {
  title: "视觉档案馆 — AI Visual Archive",
  description: "基于视觉风格的个人灵感档案馆,AI 自动分析归类。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
