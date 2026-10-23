import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <div className="errorpage">
        <div className="code num">404</div>
        <h2>That page does not exist</h2>
        <p className="hint">The link may be old, or the address was typed wrong. Nothing has changed with your leave.</p>
        <div className="inline">
          <Link href="/" className="btn primary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
