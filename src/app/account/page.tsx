import Avatar from "@/components/Avatar";
import PasswordForm from "@/components/PasswordForm";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main>
      <section className="block">
        <div className="sec-head">
          <h2>Account</h2>
        </div>
        <div className="item">
          <Avatar id={user.id} name={user.name} />
          <div className="t">
            <div className="l1">
              {user.name} {user.role === "admin" ? <span className="chip admin">Admin</span> : null}
            </div>
            <div className="l2">{user.email}</div>
          </div>
        </div>
        <div className="hint">Your name and email are set by the admin. Ask them if either needs changing.</div>
      </section>
      <section className="block">
        <div className="sec-head">
          <h2>Change password</h2>
        </div>
        <PasswordForm />
      </section>
    </main>
  );
}
