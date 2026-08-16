"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const newChat = () => {
    localStorage.removeItem("delphi-session-id");
    router.push("/");
    window.dispatchEvent(new Event("delphi:new-chat"));
  };

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-ink-200/70 bg-surface/70">
      <div className="px-5 pb-3 pt-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink-900">
          <span className="text-mirror-600">delphi</span>
        </Link>
        <button
          onClick={newChat}
          className="mt-4 w-full rounded-xl border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 shadow-soft transition hover:border-mirror-300 hover:text-mirror-700"
        >
          + 新对话
        </button>
      </div>

      <div className="flex-1" />

      <div className="border-t border-ink-200/70 px-3 py-3">
        <NavLink href="/settings" active={pathname === "/settings"}>⚙️ 设置</NavLink>
      </div>
    </aside>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`block rounded-lg px-2 py-1.5 transition ${
        active ? "bg-mirror-50 font-medium text-mirror-700" : "text-ink-600 hover:bg-ink-100"
      }`}
    >
      {children}
    </Link>
  );
}
