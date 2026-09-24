import { NextResponse } from "next/server";
import webpush from "web-push";
import { getQuote } from "@/lib/finnhub";
import { updatePriceAlerts, type SavedPriceAlert } from "@/lib/priceAlerts";

export const runtime = "nodejs";
export const maxDuration = 60;
let checking = false;

export async function GET(request: Request) {
  if (checking) return NextResponse.json({ error: "A price check is already running." }, { status: 409 });
  const secret = process.env.ALERT_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ error: "Web Push keys are not configured." }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:alerts@example.com", publicKey, privateKey);
  checking = true;
  try {
  const store = await updatePriceAlerts(current => ({ alerts: [...current.alerts], subscriptions: [...current.subscriptions] }));
  const prices = new Map<string, number>(); const fired: SavedPriceAlert[] = []; const expired = new Set<string>();
  for (const alert of store.alerts) {
    try {
      let latest = prices.get(alert.symbol);
      if (latest === undefined) { latest = (await getQuote(alert.symbol)).c; if (!latest || latest <= 0) continue; prices.set(alert.symbol, latest); }
      const hit = alert.direction === "above" ? alert.lastPrice < alert.price && latest >= alert.price
        : alert.direction === "below" ? alert.lastPrice > alert.price && latest <= alert.price
          : (alert.lastPrice - alert.price) * (latest - alert.price) <= 0 && alert.lastPrice !== latest;
      if (hit) fired.push(alert);
      else alert.lastPrice = latest;
    } catch { /* Keep the alert active after transient market-data errors. */ }
  }
  if (fired.length) {
    const subscriptions = new Map(store.subscriptions.map(subscription => [subscription.deviceId, subscription]));
    for (const alert of fired) {
      const subscription = subscriptions.get(alert.deviceId); if (!subscription) { expired.add(alert.id); continue; }
      const direction = alert.direction === "below" ? "fell below" : alert.direction === "above" ? "rose above" : "passed";
      try { await webpush.sendNotification(subscription, JSON.stringify({ title: "Stock price alert", body: `${alert.name} (${alert.symbol}) ${direction} $${alert.price.toFixed(2)}.`, url: `/stock/${encodeURIComponent(alert.symbol)}` })); expired.add(alert.id); }
      catch (error) { if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) expired.add(alert.id); }
    }
  }
  await updatePriceAlerts(current => {
    current.alerts = current.alerts.filter(alert => !expired.has(alert.id));
    const triggered = new Set(fired.map(alert => alert.id));
    for (const alert of current.alerts) { const latest = prices.get(alert.symbol); if (latest && !triggered.has(alert.id)) alert.lastPrice = latest; }
  });
  return NextResponse.json({ checked: store.alerts.length, triggered: fired.length });
  } finally { checking = false; }
}
