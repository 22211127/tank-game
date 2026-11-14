import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "跑男爬爬虾大战",
  description: "用 Next.js + Canvas 构建的经典坦克大战游戏",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
