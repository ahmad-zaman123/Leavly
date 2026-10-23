import Link from "next/link";
import { sql } from "drizzle-orm";
import AuthForm from "@/frontend/components/AuthForm";
import AuthShell from "@/frontend/components/AuthShell";
import { db } from "@/backend/db";
import { users } from "@/backend/db/schema";
import { login } from "@/backend/lib/actions";
import { ensureDefaults } from "@/backend/lib/data";
import { googleConfig } from "@/backend/lib/google";

const ERRORS: Record<string, string> = {
  "not-invited": "That Google account is not on the team yet. Ask your admin to add your email, then try again.",
  deactivated: "This account has been deactivated. Ask your admin.",
  "google-failed": "Google sign-in did not complete. Try again, or use your password.",
  "google-off": "Google sign-in is not set up on this site.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await ensureDefaults();
  const { error } = await searchParams;
  const google = !!googleConfig();
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
      {error && ERRORS[error] ? <div className="msg error">{ERRORS[error]}</div> : null}
      {google ? (
        <>
          <a href="/api/auth/google" className="btn googlebtn">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17z" />
              <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
              <path
                fill="#34A853"
                d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-3.9-13.5-9.4l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
              />
            </svg>
            Continue with Google
          </a>
          <div className="or">
            <span>or with a password</span>
          </div>
        </>
      ) : null}
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
