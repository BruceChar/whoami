import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "delphi —— 一面照向内心的镜子",
  description: "自我认知 Agent：看见自己如何思考",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-ink-950 text-slate-200 antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 pb-10 text-center text-xs text-slate-600">
          delphi —— 一面照向内心的镜子 · Be water my friend.
        </footer>
      </body>
    </html>
  );
}
