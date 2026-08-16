import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "delphi — a mirror into the mind",
  description: "Self-knowledge agent: see how you think",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-canvas text-ink-800 antialiased">{children}</body>
    </html>
  );
}
