import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { invitedBy?: string; nickname?: string };
}) {
  return (
    <LoginForm
      initialNickname={searchParams?.nickname || ""}
      invitedBy={searchParams?.invitedBy || ""}
    />
  );
}
