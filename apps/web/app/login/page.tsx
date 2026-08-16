import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { deployMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { invitedBy?: string };
}) {
  // local mode has no accounts — send visitors straight to the chat
  if (deployMode() === "local") {
    redirect("/");
  }
  return <LoginForm invitedBy={searchParams?.invitedBy || ""} />;
}
