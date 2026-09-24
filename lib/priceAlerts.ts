import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type AlertDirection = "crossing" | "below" | "above";
export interface SavedPriceAlert { id: string; deviceId: string; symbol: string; name: string; price: number; direction: AlertDirection; lastPrice: number; createdAt: number }
export interface SavedPushSubscription { deviceId: string; endpoint: string; keys: { p256dh: string; auth: string } }
interface Store { alerts: SavedPriceAlert[]; subscriptions: SavedPushSubscription[] }
const file = path.join(process.cwd(), "data", "price-alerts.json");
let queue: Promise<unknown> = Promise.resolve();

async function readStore(): Promise<Store> {
  try { return JSON.parse(await readFile(file, "utf8")) as Store; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { alerts: [], subscriptions: [] }; throw error; }
}

export function updatePriceAlerts<T>(update: (store: Store) => T | Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const store = await readStore();
    const result = await update(store);
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    await writeFile(temporary, JSON.stringify(store), "utf8");
    await rename(temporary, file);
    return result;
  });
  queue = next.catch(() => undefined);
  return next;
}

export async function listDeviceAlerts(deviceId: string) {
  const next = queue.then(async () => (await readStore()).alerts.filter(alert => alert.deviceId === deviceId));
  queue = next.catch(() => undefined);
  return next;
}

export async function addDeviceAlert(alert: SavedPriceAlert, subscription: SavedPushSubscription) {
  return updatePriceAlerts(store => {
    store.subscriptions = store.subscriptions.filter(item => item.deviceId !== subscription.deviceId);
    store.subscriptions.push(subscription);
    store.alerts.push(alert);
  });
}

export async function deleteDeviceAlert(deviceId: string, id: string) {
  return updatePriceAlerts(store => { store.alerts = store.alerts.filter(alert => alert.deviceId !== deviceId || alert.id !== id); });
}
