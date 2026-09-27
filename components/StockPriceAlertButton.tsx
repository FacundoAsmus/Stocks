"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { getAlertDeviceId, notifyPriceAlertsChanged } from "@/lib/priceAlertClient";

type Direction = "crossing" | "below" | "above";
type PriceAlert = { id: string; symbol: string; name: string; price: number; direction: Direction; lastPrice: number };
function decodeKey(value: string) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), char => char.charCodeAt(0)); }

export function StockPriceAlertButton({ symbol, name, currentPrice, mobile = false, mobileHeader = false }: {
  symbol: string; name: string; currentPrice: number; mobile?: boolean; mobileHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [price, setPrice] = useState("");
  const [direction, setDirection] = useState<Direction>("crossing");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [message, setMessage] = useState("");
  const ownAlerts = alerts.filter(alert => alert.symbol === symbol);

  function closeAlert() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 240);
  }

  useEffect(() => {
    setMounted(true);
    if (!navigator.serviceWorker) return;
    fetch(`/api/alerts?deviceId=${encodeURIComponent(getAlertDeviceId())}`).then(response => response.ok ? response.json() : null).then(data => { if (data?.alerts) setAlerts(data.alerts); }).catch(() => {});
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

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
      const response = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getAlertDeviceId(), alert: { symbol, name, price: target, direction, lastPrice: currentPrice }, subscription: subscription.toJSON() }) });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save alert.");
      const next = [...alerts, { id: result.id!, symbol, name, price: target, direction, lastPrice: currentPrice }];
      setAlerts(next);
      notifyPriceAlertsChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save alert."); return; }
    setPrice(""); setMessage("Alert saved");
    window.setTimeout(() => { closeAlert(); setMessage(""); }, 700);
  }

  async function removeAlert(id: string) {
    const response = await fetch(`/api/alerts?deviceId=${encodeURIComponent(getAlertDeviceId())}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Unable to remove alert. Try again."); return; }
    setAlerts(current => current.filter(alert => alert.id !== id));
    notifyPriceAlertsChanged();
  }

  return <>
    <button type="button" aria-label="Price alerts" title="Price alerts" onClick={() => setOpen(true)}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-0 bg-transparent text-accent transition hover:bg-white/5 ${mobile && !mobileHeader ? "fixed" : ""} ${mobileHeader ? "z-[50] ml-auto" : ""}`}
      style={mobile && !mobileHeader ? { top: "calc(0.75rem + env(safe-area-inset-top))", right: "1rem", zIndex: 500, background: "transparent" } : undefined}>
      <Bell className="h-4 w-4" />
      {ownAlerts.length > 0 && <span className="absolute -mt-7 ml-7 min-w-4 rounded-full bg-accent px-1 text-[9px] font-bold text-black">{ownAlerts.length}</span>}
    </button>
    {mounted && open && createPortal(
      <div className="smoked-glass-backdrop fixed inset-0 z-[1200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.16)", backdropFilter: "blur(12px) brightness(0.97)", WebkitBackdropFilter: "blur(12px) brightness(0.97)" }} onClick={closeAlert}>
        <div className="smoked-glass-surface w-full max-w-sm rounded-3xl border border-white/15 p-5 shadow-2xl" style={{ animation: closing ? "desktopCalendarSink 0.24s cubic-bezier(0.22,1,0.36,1) forwards" : "desktopCalendarRise 0.24s cubic-bezier(0.22,1,0.36,1) both", background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)" }} onClick={event => event.stopPropagation()}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-text-primary">Alerts</h2>
            <button aria-label="Close alerts" onClick={closeAlert} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-black transition hover:brightness-105 active:scale-95"><X className="h-4 w-4" /></button>
          </div>
          <label className="mb-2 block text-xs font-medium text-text-muted">Price</label>
          <input type="number" min="0" step="any" inputMode="decimal" placeholder={`Current $${currentPrice.toFixed(2)}`} value={price} onChange={event => setPrice(event.target.value)}
            className="smoked-glass-control mb-4 h-12 w-full rounded-full border border-border-subtle bg-black/30 px-4 text-sm text-text-primary outline-none focus:border-accent" />
          <label className="mb-2 block text-xs font-medium text-text-muted">Notify me</label>
          <select value={direction} onChange={event => setDirection(event.target.value as Direction)}
            className="smoked-glass-control mb-5 h-12 w-full appearance-none rounded-full border border-border-subtle bg-black/30 px-4 text-sm text-text-primary outline-none focus:border-accent">
            <option value="crossing">Alert when passing</option>
            <option value="below">Alert only when going below</option>
            <option value="above">Alert when going above</option>
          </select>
          {ownAlerts.length > 0 && <div className="mb-4 space-y-2">{ownAlerts.map(alert => <div key={alert.id} className="smoked-glass-control flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-sm text-text-muted"><span>${alert.price.toFixed(2)} · {alert.direction === "crossing" ? "Passing" : alert.direction === "below" ? "Below" : "Above"}</span><button onClick={() => removeAlert(alert.id)} className="text-xs text-accent">Remove</button></div>)}</div>}
          {message && <p role="status" className="mb-3 text-xs text-accent">{message}</p>}
          <button onClick={saveAlert} className="h-11 w-full rounded-full bg-accent text-sm font-semibold text-black">Save</button>
        </div>
      </div>, document.body
    )}
    <style>{`@keyframes desktopCalendarRise { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes desktopCalendarSink { from { transform: scale(1); opacity: 1; } to { transform: scale(0.94); opacity: 0; } }`}</style>
  </>;
}
