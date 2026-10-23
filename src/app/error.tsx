"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main>
      <div className="errorpage">
        <div className="code num">500</div>
        <h2>Something went wrong</h2>
        <p className="hint">
          The page hit an error. Nothing you entered was lost unless it was mid-save. Try again, and tell your admin if it keeps happening.
          {error.digest ? <span className="num"> Ref {error.digest}</span> : null}
        </p>
        <div className="inline">
          <button className="btn primary" type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
