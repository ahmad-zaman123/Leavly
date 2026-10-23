import Link from "next/link";
import { sql } from "drizzle-orm";
import AuthForm from "@/frontend/components/AuthForm";
import AuthShell from "@/frontend/components/AuthShell";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { login } from "@/backend/lib/actions";
import { ensureDefaults } from "@/backend/lib/data";

export default async function LoginPage() {
  await ensureDefaults();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  const fresh = Number(n) === 0;
  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the email and password your admin gave you."
      footer={
        fresh ? (
          <>
            Nobody has an account yet. <Link href="/register">Set up Leavly</Link>
          </>
        ) : (
          <>No account? Ask your admin to add you.</>
        )
      }
    >
      <AuthForm
        action={login}
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@company.com", autoFocus: true },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthShell>
  );
}
