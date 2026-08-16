import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { invitedBy?: string };
}) {
  return <LoginForm invitedBy={searchParams?.invitedBy || ""} />;
}
