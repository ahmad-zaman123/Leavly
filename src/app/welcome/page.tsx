import { redirect } from "next/navigation";
import AuthShell from "@/frontend/components/AuthShell";
import FirstPasswordForm from "@/frontend/components/FirstPasswordForm";
import { requireUser } from "@/backend/lib/auth";
import { logout } from "@/backend/lib/actions";

export default async function WelcomePage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/");
  return (
    <AuthShell
      title={`Welcome, ${user.name.split(" ")[0]}`}
      subtitle="You signed in with a starting password from your admin. Choose your own before continuing. Only you will know it."
      footer={
        <form action={logout}>
          <button className="btn link" type="submit">
            Not you? Sign out
          </button>
        </form>
      }
    >
      <FirstPasswordForm />
    </AuthShell>
  );
}
