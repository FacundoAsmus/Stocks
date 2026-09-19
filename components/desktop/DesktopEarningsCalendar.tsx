"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { todayStr } from "@/lib/earnings";
import { formatCompact, formatCurrency } from "@/lib/format";
import { WEEKDAYS } from "@/components/mobile/EarningsCalendarButton";
import { WheelPrice } from "@/components/PriceChart";
import type { EarningsEvent } from "@/types/stock";

type QuarterMetric = "revenue" | "eps";

function sentimentColorForHeight(percentage: number) {
  const stops: [number, [number, number, number]][] = [
    [0, [220, 38, 38]], [25, [249, 115, 22]], [50, [250, 204, 21]],
    [75, [163, 230, 53]], [100, [52, 211, 153]]
  ];
  let low = stops[0];
  let high = stops[stops.length - 1];
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (percentage >= stops[index][0] && percentage <= stops[index + 1][0]) {
      low = stops[index];
      high = stops[index + 1];
      break;
    }
  }
  const progress = (percentage - low[0]) / (high[0] - low[0] || 1);
  const red = Math.round(low[1][0] + (high[1][0] - low[1][0]) * progress);
  const green = Math.round(low[1][1] + (high[1][1] - low[1][1]) * progress);
  const blue = Math.round(low[1][2] + (high[1][2] - low[1][2]) * progress);
  return `rgb(${red}, ${green}, ${blue})`;
}

function QuarterMetricChart({
  title,
  metric,
  events,
  selectedDate
}: {
  title: string;
  metric: QuarterMetric;
  events: EarningsEvent[];
  selectedDate: string;
}) {
  const [animated, setAnimated] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const points = events.map((event) => {
    const actual = metric === "revenue" ? event.revenueActual : event.epsActual;
    const estimate = metric === "revenue" ? event.revenueEstimate : event.epsEstimate;
    return { event, actual, estimate, value: actual ?? estimate, isEstimate: event.date > todayStr() };
  });
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const latestValue = [...points].reverse().find((point) => point.value !== null)?.value ?? null;
  // The report card opens for one specific quarter. Keep that quarter's
  // number in view by default, even when the chart also includes newer
  // scheduled quarters; hovering a bar temporarily overrides it.
  const selectedQuarterValue = points.find((point) => point.event.date === selectedDate)?.value ?? latestValue;
  const displayedValue = hoveredValue ?? selectedQuarterValue;
  const maximum = Math.max(...values.map((value) => Math.abs(value)), 1);
  const hasNegative = values.some((value) => value < 0);
  const baseline = hasNegative ? "45%" : "14%";

  return (
    <section>
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
      <div className="mb-5 text-text-primary">
        <WheelPrice value={displayedValue === null ? "N/A" : metric === "revenue" ? `$${formatCompact(displayedValue)}` : formatCurrency(displayedValue)} size="xs" />
      </div>
      <div className="relative h-56 border-y border-border-subtle">
        <div
          className="absolute inset-x-0 border-t border-border-subtle"
          style={hasNegative ? { top: baseline } : { bottom: baseline }}
          aria-hidden
        />
        <div className="grid h-full grid-flow-col auto-cols-fr">
          {points.map(({ event, value, isEstimate }) => {
            const percentage = value === null ? 0 : (Math.abs(value) / maximum) * 100;
            const height = value === null ? 0 : Math.max(percentage * (hasNegative ? 0.4 : 0.78), 3);
            const negative = (value ?? 0) < 0;
            const selected = event.date === selectedDate;
            const formattedValue = metric === "revenue" ? `$${formatCompact(value)}` : formatCurrency(value);
            return (
              <div
                key={event.date}
                className="relative border-l border-border-subtle first:border-l-0"
                onMouseEnter={() => { if (value !== null) setHoveredValue(value); }}
                onMouseLeave={() => setHoveredValue(null)}
              >
                {value !== null && (
                  <div
                    className={`absolute left-1/2 w-1/4 max-w-5 -translate-x-1/2 rounded-sm ${
                      isEstimate
                        ? selected
                          ? "border border-accent bg-accent/15"
                          : "border border-accent/70 bg-accent/15 opacity-45"
                        : selected
                          ? "border-2 border-accent"
                          : ""
                    }`}
                    style={{
                      ...(negative ? { top: baseline } : { bottom: hasNegative ? "55%" : baseline }),
                      height: animated ? `${height}%` : "0%",
                      ...(!isEstimate ? {
                        backgroundColor: sentimentColorForHeight(percentage),
                        boxShadow: `0 0 10px ${sentimentColorForHeight(percentage).replace("rgb(", "rgba(").replace(")", ", 0.42)")}`
                      } : {}),
                      transition: "height 1.657s cubic-bezier(0.22, 1, 0.36, 1)"
                    }}
                    aria-label={`${event.year} Q${event.quarter}: ${formattedValue}${isEstimate ? " estimate" : " actual"}`}
                  />
                )}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-accent">Q{event.quarter}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DesktopQuarterDetail({
  event,
  earnings,
  onBack
}: {
  event: EarningsEvent;
  earnings: EarningsEvent[];
  onBack: () => void;
}) {
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" })
    .format(new Date(`${event.date}T00:00:00`));
  const sorted = [...earnings].sort((a, b) => a.date.localeCompare(b.date));
  const selectedIndex = Math.max(0, sorted.findIndex((item) => item.date === event.date));
  const chartEvents = sorted.slice(Math.max(0, selectedIndex - 4), selectedIndex + 5);

  return (
    <div className="earnings-detail-glass w-full overflow-y-auto rounded-2xl p-5 shadow-2xl" style={{ maxWidth: "min(680px, calc(100vw - 2rem))", maxHeight: "calc(100vh - 2rem)" }} onClick={(click) => click.stopPropagation()}>
      <div className="mb-5 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-black">
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Q{event.quarter} {event.year}</p>
          <p className="text-sm text-text-muted">{dateLabel}</p>
        </div>
      </div>
      <div className="space-y-8 border-t border-white/10 pt-5">
        <QuarterMetricChart title="Earnings (Revenue)" metric="revenue" events={chartEvents} selectedDate={event.date} />
        <QuarterMetricChart title="EPS" metric="eps" events={chartEvents} selectedDate={event.date} />
      </div>
    </div>
  );
}

// ─── One month, sized to sit 4-across in a year grid (not full-width like
// the phone version's single-column month) ─────────────────────────────────
function MiniMonthGrid({
  monthDate,
  eventsByDate,
  onSelect,
  today
}: {
  monthDate: Date;
  eventsByDate: Map<string, EarningsEvent>;
  onSelect: (event: EarningsEvent) => void;
  today: string;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long" }).format(monthDate);

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <div className="flex flex-col">
      <p className="mb-1.5 text-center text-xs font-bold uppercase tracking-widest text-accent">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((d, i) => (
          <p key={i} className="text-center text-[9px] font-bold uppercase text-text-muted">{d}</p>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} className="h-5" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const event = eventsByDate.get(dateStr);
          const isToday = dateStr === today;
          // Past dates fade to grey, today stays green, and anything still
          // to come reads as solid/bold primary text — same three-way split
          // used on the phone version's calendar.
          const isPast = dateStr < today;
          return (
            <div key={dateStr} className="flex h-5 items-center justify-center">
              {event ? (
                <button
                  onClick={() => onSelect(event)}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-black transition active:scale-90"
                >
                  {day}
                </button>
              ) : (
                <span
                  className={`text-[9px] font-bold ${isToday ? "text-accent" : isPast ? "text-text-muted" : "text-text-primary"}`}
                >
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trigger button + full-year 4×3 calendar overlay + detail popup ────────
// Desktop-only counterpart to components/mobile/EarningsCalendarButton.tsx.
// Same data (quarters marked with a green circle, today in green text,
// clicking a quarter opens the same detail bubble) — different layout: a
// 4-column × 3-row grid of full months for one year at a time, instead of
// the phone's single-column list you scroll through month by month.
export function DesktopEarningsCalendar({
  earnings,
  containerRef
}: {
  earnings: EarningsEvent[];
  // Kept optional for compatibility with prior desktop-detail callers. It is
  // intentionally unused by the calendar UI.
  symbol?: string;
  /** Confines the overlay to this element's bounds (the watchlist split
   *  view's right-hand column) instead of the full viewport. Falls back to
   *  document.body on the standalone stock page. */
  containerRef?: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selected, setSelected] = useState<EarningsEvent | null>(null);
  const today = todayStr();
  const [year, setYear] = useState(() => new Date().getFullYear());

  // Year-back navigation limit: you can only ever go one year behind the
  // real current year (never two+), and even that one year back is only
  // reachable during the first 100 days of the current year — once more
  // than 100 days have passed since Jan 1, last year's calendar is no
  // longer relevant enough to keep showing, so the earliest reachable year
  // becomes the current year itself.
  const minYear = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const daysSinceJan1 = Math.floor(
      (now.getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceJan1 < 100 ? currentYear - 1 : currentYear;
  }, []);
  // Forward navigation is capped the same way: never more than one year
  // ahead of the real current year (e.g. from 2026 you can reach 2027, but
  // not 2028).
  const maxYear = useMemo(() => new Date().getFullYear() + 1, []);
  const canGoBack = year > minYear;
  const canGoForward = year < maxYear;

  const eventsByDate = useMemo(() => {
    const m = new Map<string, EarningsEvent>();
    earnings.forEach((e) => m.set(e.date, e));
    return m;
  }, [earnings]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  const portalTarget = containerRef?.current ?? (typeof document !== "undefined" ? document.body : null);

  function closeCalendar() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 240);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setClosing(false); setOpen(true); }}
        aria-label="Earnings calendar"
        className="flex h-7 w-7 items-center justify-center text-accent active:opacity-60"
      >
        <CalendarDays className="h-[18px] w-[18px]" />
      </button>

      {open && portalTarget && createPortal(
        <div
          className={containerRef ? "absolute inset-0 z-[9999] flex items-center justify-center p-6" : "fixed inset-0 z-[9999] flex items-center justify-center p-6"}
          // Match the AI chat backdrop: blur the underlying panel without
          // laying a dark tint over it, so light mode stays bright.
          style={{ background: "transparent", backdropFilter: "blur(12px) brightness(0.97)", WebkitBackdropFilter: "blur(12px) brightness(0.97)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCalendar(); }}
        >
          <div
            className="earnings-detail-glass flex w-full flex-col overflow-hidden rounded-2xl border border-white/25 shadow-2xl"
            style={{
              maxWidth: "min(880px, 100%)",
              maxHeight: "100%",
              animation: closing
                ? "desktopCalendarSink 0.24s cubic-bezier(0.22,1,0.36,1) forwards"
                : "desktopCalendarRise 0.24s cubic-bezier(0.22,1,0.36,1) both",
              backdropFilter: "blur(34px) saturate(160%)",
              WebkitBackdropFilter: "blur(34px) saturate(160%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)"
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent" />
                <p className="text-sm font-bold text-accent">Earnings Calendar</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setYear((y) => Math.max(minYear, y - 1))}
                  aria-label="Previous year"
                  disabled={!canGoBack}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-text-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-bold text-text-primary">{year}</span>
                <button
                  onClick={() => setYear((y) => Math.min(maxYear, y + 1))}
                  aria-label="Next year"
                  disabled={!canGoForward}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-text-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={closeCalendar}
                  aria-label="Close"
                  className="ml-1 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-black"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-4 grid-rows-3 gap-x-6 gap-y-4 overflow-y-auto p-5">
              {months.map((monthDate) => (
                <MiniMonthGrid
                  key={monthDate.getMonth()}
                  monthDate={monthDate}
                  eventsByDate={eventsByDate}
                  onSelect={setSelected}
                  today={today}
                />
              ))}
            </div>
          </div>
        </div>,
        portalTarget
      )}

      {selected && portalTarget && createPortal(
        <div
          className={containerRef ? "absolute inset-0 z-[10000] flex items-center justify-center p-4" : "fixed inset-0 z-[10000] flex items-center justify-center p-4"}
          style={{ background: "transparent", backdropFilter: "blur(12px) brightness(0.97)", WebkitBackdropFilter: "blur(12px) brightness(0.97)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <DesktopQuarterDetail event={selected} earnings={earnings} onBack={() => setSelected(null)} />
        </div>,
        portalTarget
      )}

      <style>{`
        @keyframes desktopCalendarRise {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes desktopCalendarSink {
          from { transform: scale(1);    opacity: 1; }
          to   { transform: scale(0.94); opacity: 0; }
        }
        .earnings-detail-glass {
          background: linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.35));
        }
        html.light-mode .earnings-detail-glass {
          background: linear-gradient(155deg, rgba(255,255,255,0.72), rgba(255,255,255,0.58) 40%, rgba(255,255,255,0.42));
        }
        html.light-mode .earnings-detail-glass,
        html.light-mode .earnings-detail-glass .text-text-primary {
          color: #000;
        }
        html.light-mode .earnings-detail-glass .text-text-muted {
          color: #6e6e80;
        }
      `}</style>
    </>
  );
}
