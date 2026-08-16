import Link from "next/link";

const LINKS = [
  { href: "/", label: "仪表盘" },
  { href: "/chat", label: "对话" },
  { href: "/persona", label: "画像" },
  { href: "/timeline", label: "时间线" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-ink-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
          🪞 <span className="text-mirror">delphi</span>
        </Link>
        <div className="flex gap-4 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-400 transition hover:text-mirror">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden text-xs text-slate-600 sm:block">自我认知 Agent</span>
          <Link
            href="/settings"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-mirror hover:text-mirror"
          >
            ⚙️ 设置
          </Link>
        </div>
      </nav>
    </header>
  );
}
