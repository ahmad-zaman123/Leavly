/** Shared layout for the sign-in, setup and welcome screens: a brand panel beside the form card. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="authpage">
      <aside className="brandpanel" aria-hidden>
        <img src="/icon.svg" alt="" width={56} height={56} />
        <h2>Leave, kept simple.</h2>
        <p>One place for the team's days off. No forms to chase, no spreadsheet to update.</p>
        <ul>
          <li>
            <i />
            Log a day in two clicks
          </li>
          <li>
            <i />
            Balance that counts working days only
          </li>
          <li>
            <i />
            Your calendar, your history, one place
          </li>
        </ul>
      </aside>
      <div className="authcard">
        <div className="authhead">
          <h1>{title}</h1>
          {subtitle ? <p className="hint">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="authfoot">{footer}</div> : null}
      </div>
    </main>
  );
}
