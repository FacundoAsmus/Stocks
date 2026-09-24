import { NextResponse } from "next/server";
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  return key ? NextResponse.json({ publicKey: key }) : NextResponse.json({ error: "Web Push is not configured on the server." }, { status: 503 });
}
