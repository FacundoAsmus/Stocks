import { NextResponse } from "next/server";
import { addDeviceAlert, deleteDeviceAlert, listDeviceAlerts, type AlertDirection } from "@/lib/priceAlerts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? "";
  if (!/^[\w-]{16,80}$/.test(deviceId)) return NextResponse.json({ error: "Invalid device." }, { status: 400 });
  try { return NextResponse.json({ alerts: await listDeviceAlerts(deviceId) }); }
  catch { return NextResponse.json({ error: "Alert storage is unavailable. Check the Upstash Redis environment variables in Vercel." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { deviceId?: string; alert?: Record<string, unknown>; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
    const { deviceId, alert, subscription } = body;
    const symbol = typeof alert?.symbol === "string" ? alert.symbol.toUpperCase() : "";
    const price = Number(alert?.price); const direction = alert?.direction as AlertDirection;
    if (!deviceId || !/^[\w-]{16,80}$/.test(deviceId) || !/^[A-Z.^-]{1,12}$/.test(symbol) || !Number.isFinite(price) || price <= 0 || !["crossing", "below", "above"].includes(direction)) return NextResponse.json({ error: "Invalid alert." }, { status: 400 });
    if (!subscription?.endpoint?.startsWith("https://") || !subscription.keys?.p256dh || !subscription.keys.auth) return NextResponse.json({ error: "Push subscription is required." }, { status: 400 });
    const id = crypto.randomUUID();
    await addDeviceAlert({ id, deviceId, symbol, name: String(alert?.name ?? symbol).slice(0, 120), price, direction, lastPrice: Number(alert?.lastPrice) || price, createdAt: Date.now() }, { deviceId, endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Unable to persist stock price alert:", error);
    return NextResponse.json({ error: "Alert storage failed. Check that the Upstash Redis REST URL and token are correct in Vercel." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url); const deviceId = searchParams.get("deviceId") ?? ""; const id = searchParams.get("id") ?? "";
  if (!/^[\w-]{16,80}$/.test(deviceId) || !/^[\w-]{8,80}$/.test(id)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try { await deleteDeviceAlert(deviceId, id); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Alert storage is unavailable." }, { status: 503 }); }
}
