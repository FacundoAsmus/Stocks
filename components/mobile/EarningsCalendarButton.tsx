"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft } from "lucide-react";

import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import {
  epsSurprisePct,
  expectedEpsGrowthPct,
  expectedRevenueGrowthPct,
  isReported,
  revenueSurprisePct,
  todayStr
} from "@/lib/earnings";
import type { EarningsEvent } from "@/types/stock";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function fmtRevenue(value: number | null) {
  return value !== null ? `$${formatCompact(value)}` : "N/A";
}

function toneOf(pct: number | null): "positive" | "negative" | "neutral" {
  if (pct === null) return "neutral";
  return pct >= 0 ? "positive" : "negative";
}

// ─── One quarter's detail card ──────────────────────────────────────────────
function StatBlock({
  title, primaryLabel, primaryValue, secondaryLabel, secondaryValue, tone
}: {
  title: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="px-0.5 py-2.5">
      <p className="text-xs uppercase tracking-wider text-text-muted mb-2">{title}</p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">{primaryLabel}</p>
          <p className="text-lg font-semibold text-text-primary">{primaryValue}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">{secondaryLabel}</p>
          <p className={`text-lg font-semibold ${
            tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-text-muted"
          }`}>
            {secondaryValue}
          </p>
        </div>
      </div>
    </div>
  );
}

function EarningsDetailCard({
  event, earnings, onBack
}: { event: EarningsEvent; earnings: EarningsEvent[]; onBack: () => void }) {
  const reported = isReported(event);
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" })
    .format(new Date(`${event.date}T00:00:00`));

  const revPct = reported ? revenueSurprisePct(event) : expectedRevenueGrowthPct(earnings, event);
  const epsPct = reported ? epsSurprisePct(event)      : expectedEpsGrowthPct(earnings, event);

  return (
    <div
      className="w-full rounded-2xl p-5 shadow-2xl"
      style={{
        maxWidth: "min(380px, calc(100vw - 2rem))",
        animation: "detailFadeIn 0.18s ease both",
        background: "linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.35))",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        boxShadow: "0 10px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 0 0 1px rgba(255,255,255,0.05)"
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-positive">Q{event.quarter} {event.year}</p>
          <p className="text-sm text-text-muted">{dateLabel}</p>
        </div>
      </div>

      <div className="flex flex-col">
        <StatBlock
          title="Earnings (Revenue)"
          primaryLabel="Expected"
          primaryValue={fmtRevenue(event.revenueEstimate)}
          secondaryLabel={reported ? "Result" : "vs Last Qtr"}
          secondaryValue={revPct !== null ? formatPercent(revPct) : "N/A"}
          tone={toneOf(revPct)}
        />
        <StatBlock
          title="EPS"
          primaryLabel="Expected"
          primaryValue={formatCurrency(event.epsEstimate)}
          secondaryLabel={reported ? "Result" : "vs Last Qtr"}
          secondaryValue={epsPct !== null ? formatPercent(epsPct) : "N/A"}
          tone={toneOf(epsPct)}
        />
      </div>
    </div>
  );
}

// ─── One month's grid ───────────────────────────────────────────────────────
function MonthGrid({
  monthDate, eventsByDate, onSelect, today, isCurrent, monthRef
}: {
  monthDate: Date;
  eventsByDate: Map<string, EarningsEvent>;
  onSelect: (event: EarningsEvent) => void;
  today: string;
  isCurrent: boolean;
  monthRef?: (el: HTMLDivElement | null) => void;
}) {
  const year  = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate);

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  return (
    <div className="mb-6" ref={monthRef} data-current-month={isCurrent || undefined}>
      <p className="text-sm font-semibold uppercase tracking-widest text-positive mb-2">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-y-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const event = eventsByDate.get(dateStr);
          const isToday = dateStr === today;
          return (
            <div key={dateStr} className="flex items-center justify-center py-0.5">
              {event ? (
                <button
                  onClick={() => onSelect(event)}
                  className="h-8 w-8 rounded-full bg-positive text-black text-sm font-bold flex items-center justify-center active:scale-90 transition"
                >
                  {day}
                </button>
              ) : (
                <span className={`h-8 w-8 flex items-center justify-center text-sm ${
                  isToday ? "text-positive font-bold" : "text-text-muted"
                }`}>
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

// ─── Trigger button + calendar overlay + detail popup ──────────────────────
export function EarningsCalendarButton({ earnings }: { earnings: EarningsEvent[] }) {
  const [open, setOpen]         = useState(false);
  const [closing, setClosing]   = useState(false);
  const [selected, setSelected] = useState<EarningsEvent | null>(null);
  const [origin, setOrigin]     = useState({ x: 0, y: 0 });

  const scrollRef      = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement | null>(null);

  const today = todayStr();

  // Lock the stock page's scroll while the calendar is open — only the
  // calendar's own list should move.
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Center the current month in view the moment the calendar opens.
  useLayoutEffect(() => {
    if (!open || closing) return;
    const container = scrollRef.current;
    const target = currentMonthRef.current;
    if (container && target) {
      container.scrollTop = target.offsetTop - (container.clientHeight / 2) + (target.clientHeight / 2);
    }
  }, [open, closing]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, EarningsEvent>();
    earnings.forEach(e => m.set(e.date, e));
    return m;
  }, [earnings]);

  // 12 months back from this month, through the furthest known scheduled
  // report (capped ~6 months out so we never render an unbounded tail).
  const { months, now } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    let end = new Date(now.getFullYear(), now.getMonth(), 1);
    const maxEnd = new Date(now.getFullYear(), now.getMonth() + 6, 1);

    earnings.forEach(e => {
      const d = new Date(`${e.date}T00:00:00`);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      if (monthStart > end && monthStart <= maxEnd) end = monthStart;
    });

    const list: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      list.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { months: list, now };
  }, [earnings]);

  function openCalendar(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setClosing(false);
    setOpen(true);
  }

  function closeCalendar() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 300);
  }

  // Sheet is anchored to the bottom of the viewport at 88vh tall — express
  // the button's tap point as a transform-origin relative to the sheet's own
  // box, so the open animation visibly grows out from the button.
  const sheetTop = typeof window !== "undefined" ? window.innerHeight * 0.12 : 0;
  const transformOrigin = `${origin.x}px ${origin.y - sheetTop}px`;

  return (
    <>
      <button
        type="button"
        onClick={openCalendar}
        aria-label="Earnings calendar"
        className="flex items-center justify-center h-7 w-7 text-positive active:opacity-60"
      >
        <CalendarDays className="h-[18px] w-[18px]" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full rounded-t-2xl border-t border-border-subtle flex flex-col bg-black"
            style={{
              height: "88vh",
              transformOrigin,
              animation: closing
                ? "calendarSink 0.3s cubic-bezier(0.4,0,1,1) forwards"
                : "calendarRise 0.32s cubic-bezier(0.22,1,0.36,1) both"
            }}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
              <button
                onClick={closeCalendar}
                className="flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <p className="text-sm font-semibold text-text-primary">Earnings Calendar</p>
            </div>

            <div className="grid grid-cols-7 px-4 pb-2 shrink-0">
              {WEEKDAYS.map((d, i) => (
                <p key={i} className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted">{d}</p>
              ))}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain">
              {months.map(monthDate => {
                const isCurrent = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
                return (
                  <MonthGrid
                    key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                    monthDate={monthDate}
                    eventsByDate={eventsByDate}
                    onSelect={setSelected}
                    today={today}
                    isCurrent={isCurrent}
                    monthRef={isCurrent ? (el => { currentMonthRef.current = el; }) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {selected && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <EarningsDetailCard event={selected} earnings={earnings} onBack={() => setSelected(null)} />
        </div>,
        document.body
      )}

      <style>{`
        @keyframes calendarRise {
          from { transform: scale(0.08); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
        @keyframes calendarSink {
          from { transform: scale(1);    opacity: 1; }
          to   { transform: scale(0.08); opacity: 0; }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </>
  );
}
