import { NextResponse } from "next/server";
import { isPriceAlertStorageConfigured } from "@/lib/priceAlerts";
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!isPriceAlertStorageConfigured()) return NextResponse.json({ error: "Alert storage is not configured. Add your Upstash Redis REST URL and token in Vercel." }, { status: 503 });
  return key ? NextResponse.json({ publicKey: key }) : NextResponse.json({ error: "Web Push is not configured on the server." }, { status: 503 });
}
