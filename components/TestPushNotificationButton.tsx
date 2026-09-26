"use client";
import { useState } from "react";

export function TestPushNotificationButton({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");

  async function sendTest() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      setMessage("Enable notifications by saving an alert first.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Test notification", {
        body: "Notifications are working on this device.",
        icon: "/icon.png",
        badge: "/icon.png",
      });
      setMessage("Test notification sent.");
    } catch {
      setMessage("Could not show a notification on this device.");
    }
  }

  return <div className={compact ? "mt-2" : "mt-2 border-t border-border-subtle pt-3"}>
    <button onClick={sendTest} className="w-full flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2.5 text-left">
      <span className="flex flex-col gap-0.5"><span className="text-sm text-text-primary font-medium">Test notification</span><span className="text-xs text-text-muted">Send a sample notification to this device</span></span>
      <span className="shrink-0 text-xs font-medium text-accent">Test</span>
    </button>
    {message && <p role="status" className="mt-2 text-xs text-text-muted">{message}</p>}
  </div>;
}
