// Runs once when the Next.js server process starts.
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // On some Windows machines, Node's fetch (undici) tries the IPv6 address
  // of a host first. If the system's IPv6 route is broken or unusably slow,
  // every outbound fetch (e.g. to Yahoo Finance) hangs for the full request
  // timeout before failing, even though the host is reachable over IPv4
  // (e.g. in a browser). Forcing IPv4-first DNS resolution for this Node
  // process avoids that hang. This only runs server-side, so it's safe to
  // import "dns" here.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");

    // Self-hosted Next servers stay alive between requests, so check alerts
    // once a minute without requiring a separate process. Serverless hosts
    // should invoke the same protected endpoint using their scheduler instead.
    const secret = process.env.CRON_SECRET ?? process.env.ALERT_CRON_SECRET;
    const processWithAlertTimer = globalThis as typeof globalThis & { __stockPriceAlertTimer?: NodeJS.Timeout };
    if (secret && !processWithAlertTimer.__stockPriceAlertTimer) {
      const port = process.env.PORT || "3000";
      processWithAlertTimer.__stockPriceAlertTimer = setInterval(() => {
        void fetch(`http://127.0.0.1:${port}/api/alerts/check`, {
          headers: { authorization: `Bearer ${secret}` },
        }).catch(() => undefined);
      }, 60_000);
      processWithAlertTimer.__stockPriceAlertTimer.unref();
    }
  }
}
