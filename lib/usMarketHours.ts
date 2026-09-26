const ET = "America/New_York";
const weekdayIndex = (date: Date) => date.getUTCDay();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function nthWeekday(year: number, month: number, weekday: number, nth: number) {
  const first = new Date(Date.UTC(year, month, 1));
  return new Date(Date.UTC(year, month, 1 + ((weekday - weekdayIndex(first) + 7) % 7) + 7 * (nth - 1)));
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return new Date(Date.UTC(year, month, last.getUTCDate() - ((weekdayIndex(last) - weekday + 7) % 7)));
}

function observedFixedHoliday(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (weekdayIndex(date) === 6) date.setUTCDate(date.getUTCDate() - 1);
  else if (weekdayIndex(date) === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1));
}

function exchangeClosures(year: number) {
  const dates = new Set<string>();
  for (const y of [year - 1, year, year + 1]) {
    for (const [month, day] of [[1, 1], [6, 19], [7, 4], [12, 25]] as const) {
      if (month !== 6 || day !== 19 || y >= 2022) dates.add(isoDate(observedFixedHoliday(y, month, day)));
    }
    dates.add(isoDate(nthWeekday(y, 0, 1, 3)));  // Martin Luther King Jr. Day
    dates.add(isoDate(nthWeekday(y, 1, 1, 3)));  // Washington's Birthday
    dates.add(isoDate(lastWeekday(y, 4, 1)));     // Memorial Day
    dates.add(isoDate(nthWeekday(y, 8, 1, 1)));  // Labor Day
    const thanksgiving = nthWeekday(y, 10, 4, 4);
    dates.add(isoDate(thanksgiving));
    const goodFriday = easterSunday(y); goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
    dates.add(isoDate(goodFriday));
  }
  return dates;
}

function earlyCloseDates(year: number) {
  const dates = new Set<string>();
  for (const y of [year - 1, year, year + 1]) {
    const thanksgiving = nthWeekday(y, 10, 4, 4);
    thanksgiving.setUTCDate(thanksgiving.getUTCDate() + 1);
    dates.add(isoDate(thanksgiving));
    const christmasEve = new Date(Date.UTC(y, 11, 24));
    if (weekdayIndex(christmasEve) > 0 && weekdayIndex(christmasEve) < 6) dates.add(isoDate(christmasEve));
    const independence = observedFixedHoliday(y, 7, 4);
    do { independence.setUTCDate(independence.getUTCDate() - 1); }
    while (weekdayIndex(independence) === 0 || weekdayIndex(independence) === 6);
    dates.add(isoDate(independence));
  }
  return dates;
}

export function isUsEquityMarketOpen(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const year = Number(value("year"));
  const dateKey = `${year}-${value("month")}-${value("day")}`;
  const weekday = value("weekday");
  if (weekday === "Sat" || weekday === "Sun" || exchangeClosures(year).has(dateKey)) return false;
  const minuteOfDay = Number(value("hour")) * 60 + Number(value("minute"));
  const close = earlyCloseDates(year).has(dateKey) ? 13 * 60 : 16 * 60;
  return minuteOfDay >= 9 * 60 + 30 && minuteOfDay < close;
}
