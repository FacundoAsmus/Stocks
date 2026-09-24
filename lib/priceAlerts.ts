export type AlertDirection = "crossing" | "below" | "above";
export interface SavedPriceAlert { id: string; deviceId: string; symbol: string; name: string; price: number; direction: AlertDirection; lastPrice: number; createdAt: number }
export interface SavedPushSubscription { deviceId: string; endpoint: string; keys: { p256dh: string; auth: string } }

const PREFIX = "stock-price-alerts:v1";

export function isPriceAlertStorageConfigured() {
  return Boolean((process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN));
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel.");
  return { url: url.replace(/\/$/, ""), token };
}

async function command<T>(...args: Array<string | number>): Promise<T> {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const result = await response.json() as { result?: T; error?: string };
  if (!response.ok || result.error) throw new Error(result.error ?? `Redis request failed (${response.status}).`);
  return result.result as T;
}

const alertKey = (id: string) => `${PREFIX}:alert:${id}`;
const deviceAlertSet = (deviceId: string) => `${PREFIX}:device:${deviceId}:alerts`;
const subscriptionKey = (deviceId: string) => `${PREFIX}:device:${deviceId}:subscription`;

export async function listDeviceAlerts(deviceId: string) {
  const ids = await command<string[]>("SMEMBERS", deviceAlertSet(deviceId));
  if (!ids.length) return [];
  const rows = await Promise.all(ids.map(id => command<string | null>("GET", alertKey(id))));
  return rows.filter((row): row is string => typeof row === "string").map(row => JSON.parse(row) as SavedPriceAlert);
}

export async function listAllPriceAlerts() {
  const ids = await command<string[]>("SMEMBERS", `${PREFIX}:all`);
  if (!ids.length) return [];
  const rows = await Promise.all(ids.map(id => command<string | null>("GET", alertKey(id))));
  return rows.filter((row): row is string => typeof row === "string").map(row => JSON.parse(row) as SavedPriceAlert);
}

export async function getPushSubscription(deviceId: string) {
  const row = await command<string | null>("GET", subscriptionKey(deviceId));
  return row ? JSON.parse(row) as SavedPushSubscription : null;
}

export async function addDeviceAlert(alert: SavedPriceAlert, subscription: SavedPushSubscription) {
  await Promise.all([
    command("SET", subscriptionKey(subscription.deviceId), JSON.stringify(subscription)),
    command("SET", alertKey(alert.id), JSON.stringify(alert)),
    command("SADD", deviceAlertSet(alert.deviceId), alert.id),
    command("SADD", `${PREFIX}:all`, alert.id),
  ]);
}

export async function updateStoredAlert(alert: SavedPriceAlert) {
  await command("SET", alertKey(alert.id), JSON.stringify(alert));
}

export async function deleteDeviceAlert(deviceId: string, id: string) {
  await Promise.all([
    command("DEL", alertKey(id)),
    command("SREM", deviceAlertSet(deviceId), id),
    command("SREM", `${PREFIX}:all`, id),
  ]);
}

export async function claimPriceAlertCheck() {
  return (await command<string | null>("SET", `${PREFIX}:check-lock`, crypto.randomUUID(), "NX", "EX", 55)) === "OK";
}
