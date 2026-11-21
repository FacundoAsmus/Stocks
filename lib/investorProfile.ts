export const INVESTOR_PROFILE_STORAGE_KEY = "stocks-investor-profile-v1";

export type InvestorProfile = {
  name: string;
  description: string;
  answers: number[];
};

const METRICS = [
  { key: "approach", label: "Investment approach", low: "Fundamental", high: "Technical", questionIndexes: [0, 1, 2], max: 6 },
  { key: "risk", label: "Risk tolerance", low: "Conservative", high: "Aggressive", questionIndexes: [3, 4], max: 4 },
  { key: "expertise", label: "Expertise", low: "Beginner", high: "Advanced", questionIndexes: [5, 6], max: 4 },
  { key: "horizon", label: "Investment horizon", low: "Long-term", high: "Short-term", questionIndexes: [7, 8, 9], max: 6 },
] as const;

export function readInvestorProfile(): InvestorProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INVESTOR_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InvestorProfile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 240) : "",
      answers: Array.isArray(parsed.answers) ? parsed.answers.map(Number) : [],
    };
  } catch {
    return null;
  }
}

export function isInvestorProfileComplete(profile: InvestorProfile | null | undefined): profile is InvestorProfile {
  return Boolean(
    profile && profile.name.trim() && profile.description.trim() && profile.description.length <= 240 &&
    profile.answers.length === 10 && profile.answers.every((answer) => Number.isInteger(answer) && answer >= 1 && answer <= 5),
  );
}

export function hasCompleteInvestorTest(profile: InvestorProfile | null | undefined): boolean {
  return Boolean(profile && profile.answers.length === 10 && profile.answers.every((answer) => Number.isInteger(answer) && answer >= 1 && answer <= 5));
}

function scoreProfile(profile: InvestorProfile) {
  return METRICS.map((metric, metricIndex) => {
    const raw = metric.questionIndexes.reduce<number>((total, questionIndex) => {
      const answer = profile.answers[questionIndex];
      const points = answer - 3;
      const reversed = (metricIndex === 0 && questionIndex === 1) || (metricIndex === 3 && questionIndex === 9);
      return total + (reversed ? -points : points);
    }, 0);
    return { ...metric, score: Math.round(((raw + metric.max) / (2 * metric.max)) * 100) };
  });
}

function band(score: number, low: string, high: string) {
  if (score <= 20) return `strongly ${low.toLowerCase()}`;
  if (score <= 40) return `moderately ${low.toLowerCase()}`;
  if (score <= 59) return "balanced";
  if (score <= 79) return `moderately ${high.toLowerCase()}`;
  return `strongly ${high.toLowerCase()}`;
}

/** Returns no profile context unless the user has completed every profile field. */
export function getCompleteInvestorContext(): string {
  const profile = readInvestorProfile();
  if (!isInvestorProfileComplete(profile)) return "";
  const scores = scoreProfile(profile);
  const ratings = scores.map((item) => `${item.label}: ${band(item.score, item.low, item.high)} (${item.score}/100)`).join("; ");
  const description = profile.description.trim().replace(/\s+/g, " ");
  return `\n\nInvestor profile (complete): ${profile.name.trim()}; ${ratings}; investor description: ${description}`;
}

export function getInvestorRatings(profile: InvestorProfile) {
  return scoreProfile(profile);
}
