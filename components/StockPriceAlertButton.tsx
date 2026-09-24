"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

type Direction = "crossing" | "below" | "above";
type PriceAlert = { id: string; symbol: string; name: string; price: number; direction: Direction; lastPrice: number };
const STORAGE_KEY = "market-lens-price-alerts";

function readAlerts(): PriceAlert[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as PriceAlert[]; }
  catch { return []; }
}

export function StockPriceAlertButton({ symbol, name, currentPrice, mobile = false }: {
  symbol: string; name: string; currentPrice: number; mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [price, setPrice] = useState("");
  const [direction, setDirection] = useState<Direction>("crossing");
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [message, setMessage] = useState("");
  const ownAlerts = alerts.filter(alert => alert.symbol === symbol);

  useEffect(() => { setMounted(true); setAlerts(readAlerts()); }, []);

  useEffect(() => {
    const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches;
    if (!ownAlerts.length || (mobile ? !isMobileViewport : isMobileViewport)) return;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
        if (!response.ok) return;
        const { price: latest } = await response.json() as { price: number };
        if (!Number.isFinite(latest) || latest <= 0) return;
        const all = readAlerts();
        const fired = all.filter(alert => alert.symbol === symbol && (
          alert.direction === "crossing" ? (alert.lastPrice - alert.price) * (latest - alert.price) <= 0 && alert.lastPrice !== latest && (alert.lastPrice <= alert.price || latest <= alert.price)
            : alert.direction === "above" ? alert.lastPrice < alert.price && latest >= alert.price
              : alert.lastPrice > alert.price && latest <= alert.price
        ));
        const remaining = all.filter(alert => !fired.some(item => item.id === alert.id)).map(alert =>
          alert.symbol === symbol ? { ...alert, lastPrice: latest } : alert
        );
        if (fired.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
          setAlerts(remaining);
          for (const alert of fired) {
            const verb = alert.direction === "below" ? "fell below" : alert.direction === "above" ? "rose above" : "passed";
            const body = `${alert.name} (${alert.symbol}) ${verb} $${alert.price.toFixed(2)}.`;
            if ("Notification" in window && Notification.permission === "granted") new Notification("Price alert", { body, tag: alert.id });
          }
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
        }
      } catch { /* A transient quote failure leaves the alert active. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, [symbol, ownAlerts.length, mobile]);

  async function saveAlert() {
    const target = Number(price);
    if (!Number.isFinite(target) || target <= 0) { setMessage("Enter a valid price."); return; }
    if (!("Notification" in window)) { setMessage("Notifications are not supported by this browser."); return; }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") { setMessage("Allow notifications in your browser settings to save an alert."); return; }
    const next = [...readAlerts(), { id: crypto.randomUUID(), symbol, name, price: target, direction, lastPrice: currentPrice }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAlerts(next);
    setPrice(""); setMessage("Alert saved");
    window.setTimeout(() => { setOpen(false); setMessage(""); }, 700);
  }

  function removeAlert(id: string) {
    const next = readAlerts().filter(alert => alert.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setAlerts(next);
  }

  return <>
    <button type="button" aria-label="Price alerts" title="Price alerts" onClick={() => setOpen(true)}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-subtle text-accent transition hover:border-accent/50 hover:bg-accent/10 ${mobile ? "fixed" : ""}`}
      style={mobile ? { top: "calc(0.75rem + env(safe-area-inset-top))", right: "1rem", zIndex: 500, background: "transparent" } : undefined}>
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
