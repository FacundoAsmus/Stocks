import { NextResponse } from "next/server";
import webpush from "web-push";
import { getQuote } from "@/lib/finnhub";
import { claimPriceAlertCheck, deleteDeviceAlert, getPushSubscription, listAllPriceAlerts, updateStoredAlert, type SavedPriceAlert } from "@/lib/priceAlerts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.ALERT_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ error: "Web Push keys are not configured." }, { status: 503 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:alerts@example.com", publicKey, privateKey);
  if (!await claimPriceAlertCheck()) return NextResponse.json({ error: "A price check is already running." }, { status: 409 });
  const alerts = await listAllPriceAlerts();
  const prices = new Map<string, number>(); const fired: SavedPriceAlert[] = []; const expired = new Set<string>();
  for (const alert of alerts) {
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
    for (const alert of fired) {
      const subscription = await getPushSubscription(alert.deviceId); if (!subscription) { expired.add(alert.id); continue; }
      const direction = alert.direction === "below" ? "fell below" : alert.direction === "above" ? "rose above" : "passed";
      try { await webpush.sendNotification(subscription, JSON.stringify({ title: "Stock price alert", body: `${alert.name} (${alert.symbol}) ${direction} $${alert.price.toFixed(2)}.`, url: `/stock/${encodeURIComponent(alert.symbol)}` })); expired.add(alert.id); }
      catch (error) { if ((error as { statusCode?: number }).statusCode === 404 || (error as { statusCode?: number }).statusCode === 410) expired.add(alert.id); }
    }
  }
  await Promise.all(alerts.map(async alert => {
    if (expired.has(alert.id)) return deleteDeviceAlert(alert.deviceId, alert.id);
    // Leave the previous price untouched after a transient delivery failure so
    // the threshold remains crossed and the next run retries the notification.
    if (fired.some(item => item.id === alert.id)) return;
    const latest = prices.get(alert.symbol);
    if (latest) { alert.lastPrice = latest; await updateStoredAlert(alert); }
  }));
  return NextResponse.json({ checked: alerts.length, triggered: fired.length });
}
