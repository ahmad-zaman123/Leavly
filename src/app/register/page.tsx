import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import AuthForm from "@/frontend/components/AuthForm";
import AuthShell from "@/frontend/components/AuthShell";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { setup } from "@/backend/lib/actions";
import { ensureDefaults } from "@/backend/lib/data";

export default async function SetupPage() {
  await ensureDefaults();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  if (Number(n) > 0) redirect("/login");
  return (
    <AuthShell
      title="Set up Leavly"
      subtitle="You are the first person here, so this account becomes the admin. Admins add colleagues and set leave types and holidays."
      footer={
        <>
          Already set up? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <AuthForm
        action={setup}
        submitLabel="Create admin account"
        fields={[
          { name: "name", label: "Full name", autoComplete: "name", autoFocus: true },
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters.", minLength: 8 },
        ]}
      />
    </AuthShell>
  );
}
