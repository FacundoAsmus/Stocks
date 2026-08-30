"use client";

import { useMemo, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { todayStr } from "@/lib/earnings";
import { EarningsDetailCard, WEEKDAYS } from "@/components/mobile/EarningsCalendarButton";
import type { EarningsEvent } from "@/types/stock";

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
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-positive">{monthLabel}</p>
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
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-positive text-[9px] font-bold text-black transition active:scale-90"
                >
                  {day}
                </button>
              ) : (
                <span
                  className={`text-[9px] font-bold ${isToday ? "text-positive" : isPast ? "text-text-muted" : "text-text-primary"}`}
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
  /** Confines the overlay to this element's bounds (the watchlist split
   *  view's right-hand column) instead of the full viewport. Falls back to
   *  document.body on the standalone stock page. */
  containerRef?: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
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
  const canGoBack = year > minYear;

  const eventsByDate = useMemo(() => {
    const m = new Map<string, EarningsEvent>();
    earnings.forEach((e) => m.set(e.date, e));
    return m;
  }, [earnings]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  const portalTarget = containerRef?.current ?? (typeof document !== "undefined" ? document.body : null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Earnings calendar"
        className="flex h-7 w-7 items-center justify-center text-positive active:opacity-60"
      >
        <CalendarDays className="h-[18px] w-[18px]" />
      </button>

      {open && portalTarget && createPortal(
        <div
          className={containerRef ? "absolute inset-0 z-[9999] flex items-center justify-center p-6" : "fixed inset-0 z-[9999] flex items-center justify-center p-6"}
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className="earnings-detail-glass flex w-full flex-col overflow-hidden rounded-2xl border border-white/25 shadow-2xl"
            style={{
              maxWidth: "min(880px, 100%)",
              maxHeight: "100%",
              animation: "desktopCalendarRise 0.24s cubic-bezier(0.22,1,0.36,1) both",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 0 0 1px rgba(255,255,255,0.04)"
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-positive" />
                <p className="text-sm font-bold text-text-primary">Earnings Calendar</p>
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
                  onClick={() => setYear((y) => y + 1)}
                  aria-label="Next year"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text-primary"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="ml-1 flex items-center gap-1.5 rounded-lg bg-positive px-3 py-1.5 text-sm font-semibold text-black"
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
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <EarningsDetailCard event={selected} earnings={earnings} onBack={() => setSelected(null)} />
        </div>,
        portalTarget
      )}

      <style>{`
        @keyframes desktopCalendarRise {
          from { transform: scale(0.94); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .earnings-detail-glass {
          background: linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.35));
        }
        html.light-mode .earnings-detail-glass {
          background: linear-gradient(155deg, rgba(255,255,255,0.72), rgba(255,255,255,0.58) 40%, rgba(255,255,255,0.42));
        }
        html.light-mode .earnings-detail-glass,
        html.light-mode .earnings-detail-glass .text-text-primary,
        html.light-mode .earnings-detail-glass .text-text-muted {
          color: #000;
        }
      `}</style>
    </>
  );
}
