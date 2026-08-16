import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { currentUserId } from "@/lib/server";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!currentUserId()) {
    redirect("/login");
  }
  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
