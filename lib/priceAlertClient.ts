export const ALERT_DEVICE_KEY = "market-lens-alert-device";
export const ALERT_LINES_SETTING_KEY = "pro-alert-lines";

export function getAlertDeviceId() {
  let id = localStorage.getItem(ALERT_DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(ALERT_DEVICE_KEY, id); }
  return id;
}

export function notifyPriceAlertsChanged() {
  window.dispatchEvent(new Event("price-alerts-updated"));
}
