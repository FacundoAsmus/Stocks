"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

type Direction = "crossing" | "below" | "above";
type PriceAlert = { id: string; symbol: string; name: string; price: number; direction: Direction; lastPrice: number };
const DEVICE_KEY = "market-lens-alert-device";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
function decodeKey(value: string) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), char => char.charCodeAt(0)); }

export function StockPriceAlertButton({ symbol, name, currentPrice, mobile = false, mobileHeader = false }: {
  symbol: string; name: string; currentPrice: number; mobile?: boolean; mobileHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [price, setPrice] = useState("");
  const [direction, setDirection] = useState<Direction>("crossing");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [message, setMessage] = useState("");
  const ownAlerts = alerts.filter(alert => alert.symbol === symbol);

  useEffect(() => {
    setMounted(true);
    if (!navigator.serviceWorker) return;
    fetch(`/api/alerts?deviceId=${encodeURIComponent(getDeviceId())}`).then(response => response.ok ? response.json() : null).then(data => { if (data?.alerts) setAlerts(data.alerts); }).catch(() => {});
  }, []);

  async function saveAlert() {
    const target = Number(price);
    if (!Number.isFinite(target) || target <= 0) { setMessage("Enter a valid price."); return; }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) { setMessage("Push notifications are not supported in this browser."); return; }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") { setMessage("Allow notifications in your browser settings to save an alert."); return; }
    try {
      const configResponse = await fetch("/api/alerts/config");
      const config = await configResponse.json() as { publicKey?: string; error?: string };
      if (!configResponse.ok || !config.publicKey) throw new Error(config.error || "Push is not configured on the server.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) });
      const response = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getDeviceId(), alert: { symbol, name, price: target, direction, lastPrice: currentPrice }, subscription: subscription.toJSON() }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save alert.");
      const next = [...alerts, { id: result.id!, symbol, name, price: target, direction, lastPrice: currentPrice }];
      setAlerts(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save alert."); return; }
    setPrice(""); setMessage("Alert saved");
    window.setTimeout(() => { setOpen(false); setMessage(""); }, 700);
  }

  function removeAlert(id: string) {
    setAlerts(current => current.filter(alert => alert.id !== id));
    void fetch(`/api/alerts?deviceId=${encodeURIComponent(getDeviceId())}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  return <>
    <button type="button" aria-label="Price alerts" title="Price alerts" onClick={() => setOpen(true)}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle text-accent transition hover:border-accent/50 hover:bg-accent/10 ${mobile && !mobileHeader ? "fixed" : ""} ${mobileHeader ? "z-[50] ml-auto" : ""}`}
      style={mobile && !mobileHeader ? { top: "calc(0.75rem + env(safe-area-inset-top))", right: "1rem", zIndex: 500, background: "transparent" } : undefined}>
      <Bell className="h-4 w-4" />
      {ownAlerts.length > 0 && <span className="absolute -mt-7 ml-7 min-w-4 rounded-full bg-accent px-1 text-[9px] font-bold text-black">{ownAlerts.length}</span>}
    </button>
    {mounted && open && createPortal(
      <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/35 p-4" onClick={() => setOpen(false)}>
        <div className="earnings-detail-glass w-full max-w-sm rounded-2xl border border-white/20 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Alerts</h2>
            <button aria-label="Close alerts" onClick={() => setOpen(false)} className="rounded-full p-2 text-text-muted hover:text-text-primary"><X className="h-4 w-4" /></button>
          </div>
          <label className="mb-2 block text-xs font-medium text-text-muted">Price</label>
          <input type="number" min="0" step="any" inputMode="decimal" placeholder={`Current $${currentPrice.toFixed(2)}`} value={price} onChange={event => setPrice(event.target.value)}
            className="mb-4 h-12 w-full rounded-full border border-border-subtle bg-black/30 px-4 text-sm text-text-primary outline-none focus:border-accent" />
          <label className="mb-2 block text-xs font-medium text-text-muted">Notify me</label>
          <select value={direction} onChange={event => setDirection(event.target.value as Direction)}
            className="mb-5 h-12 w-full appearance-none rounded-full border border-border-subtle bg-black/30 px-4 text-sm text-text-primary outline-none focus:border-accent">
            <option value="crossing">Alert when passing</option>
            <option value="below">Alert only when going below</option>
            <option value="above">Alert when going above</option>
          </select>
          {ownAlerts.length > 0 && <div className="mb-4 space-y-2">{ownAlerts.map(alert => <div key={alert.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm text-text-muted"><span>${alert.price.toFixed(2)} · {alert.direction === "crossing" ? "Passing" : alert.direction === "below" ? "Below" : "Above"}</span><button onClick={() => removeAlert(alert.id)} className="text-xs text-accent">Remove</button></div>)}</div>}
          {message && <p role="status" className="mb-3 text-xs text-accent">{message}</p>}
          <button onClick={saveAlert} className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-black">Save</button>
        </div>
      </div>, document.body
    )}
  </>;
}
