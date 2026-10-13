"use client";

import { useEffect } from "react";

// Catches errors thrown while rendering a page, mainly a failed catalog read
// (lib/catalog.ts). retry() re-fetches the segment from the server, so RETRY
// recovers as soon as Supabase is reachable again.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fade-in">
      <section className="signal-lost" aria-labelledby="signal-lost-title">
        <div className="sl-screen">
          <div className="sl-static" aria-hidden="true" />
          <h1 id="signal-lost-title" className="sl-title">
            SIGNAL LOST
          </h1>
        </div>
        <p className="sl-copy">
          The game list didn&apos;t load. Check your connection, then retry.
        </p>
        <button type="button" className="btn lg" onClick={() => retry()}>
          RETRY
        </button>
        {error.digest && <div className="sl-ref">ERROR REF {error.digest}</div>}
      </section>
    </div>
  );
}
