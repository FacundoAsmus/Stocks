"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft } from "lucide-react";

import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import {
  epsSurprisePct,
  expectedEpsGrowthPct,
  expectedRevenueGrowthPct,
  isReported,
  revenueSurprisePct
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
    <div className="rounded-lg bg-panel border border-border-subtle px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">{title}</p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] text-text-muted">{primaryLabel}</p>
          <p className="text-base font-semibold text-text-primary">{primaryValue}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-muted">{secondaryLabel}</p>
          <p className={`text-base font-semibold ${
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
      className="w-full rounded-2xl border border-border-subtle bg-black p-5 shadow-2xl"
      style={{ maxWidth: "min(380px, calc(100vw - 2rem))", animation: "detailFadeIn 0.18s ease both" }}
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

      <div className="flex flex-col gap-2.5">
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
  monthDate, eventsByDate, onSelect
}: {
  monthDate: Date;
  eventsByDate: Map<string, EarningsEvent>;
  onSelect: (event: EarningsEvent) => void;
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
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-positive mb-2">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-y-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const event = eventsByDate.get(dateStr);
          return (
            <div key={dateStr} className="flex items-center justify-center py-0.5">
              {event ? (
                <button
                  onClick={() => onSelect(event)}
                  className="h-7 w-7 rounded-full bg-positive text-black text-xs font-bold flex items-center justify-center active:scale-90 transition"
                >
                  {day}
                </button>
              ) : (
                <span className="h-7 w-7 flex items-center justify-center text-xs text-text-muted">{day}</span>
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
  const [selected, setSelected] = useState<EarningsEvent | null>(null);

  // Lock the stock page's scroll while the calendar is open — only the
  // calendar's own list should move.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, EarningsEvent>();
    earnings.forEach(e => m.set(e.date, e));
    return m;
  }, [earnings]);

  // 12 months back from this month, through the furthest known scheduled
  // report (capped ~6 months out so we never render an unbounded tail).
  const months = useMemo(() => {
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
    return list;
  }, [earnings]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            className="w-full rounded-t-2xl border-t border-border-subtle bg-black flex flex-col"
            style={{ height: "88vh", animation: "calendarRise 0.28s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 bg-positive text-black text-sm font-semibold px-3 py-1.5 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <p className="text-sm font-semibold text-text-primary">Earnings Calendar</p>
            </div>

            <div className="grid grid-cols-7 px-4 pb-2 shrink-0">
              {WEEKDAYS.map((d, i) => (
                <p key={i} className="text-center text-[10px] font-semibold uppercase tracking-wider text-text-muted">{d}</p>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain">
              {months.map(monthDate => (
                <MonthGrid
                  key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                  monthDate={monthDate}
                  eventsByDate={eventsByDate}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {selected && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <EarningsDetailCard event={selected} earnings={earnings} onBack={() => setSelected(null)} />
        </div>,
        document.body
      )}

      <style>{`
        @keyframes calendarRise {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </>
  );
}
