import { cn } from "@/lib/utils";

function labelForScore(score: number) {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

function colorForScore(score: number) {
  if (score <= 20) return "bg-negative";
  if (score <= 40) return "bg-orange-400";
  if (score <= 60) return "bg-accent";
  if (score <= 80) return "bg-positive";
  return "bg-emerald-300";
}

export function MarketSentiment({
  score,
  drivers
}: {
  score: number;
  drivers: string[];
}) {
  const label = labelForScore(score);

  return (
    <section className="rounded-md border border-[#3a3a42] bg-black p-5">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-positive">Market Sentiment</p>
      <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">{label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            A simple visual score based on today&apos;s move, valuation, volatility, and distance from the
            52-week range. It is a UI signal, not investment advice.
          </p>
        </div>
        <div className="min-w-48 rounded-md border border-[#3a3a42] bg-black p-4 text-center">
          <p className="text-4xl font-semibold text-text-primary">{score}</p>
          <p className="text-sm text-text-muted">out of 100</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-text-muted">
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-background">
          <div className={cn("h-full rounded-full transition-all", colorForScore(score))} style={{ width: `${score}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {drivers.map((driver) => (
          <span key={driver} className="rounded-md border border-border-subtle bg-background px-3 py-2 text-xs text-text-muted">
            {driver}
          </span>
        ))}
      </div>
    </section>
  );
}
