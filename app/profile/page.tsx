"use client";

import { useEffect, useMemo, useState } from "react";
import { OptionalSvgIcon } from "@/components/OptionalSvgIcon";
import {
  getInvestorRatings,
  hasCompleteInvestorTest,
  INVESTOR_PROFILE_STORAGE_KEY,
  readInvestorProfile,
  type InvestorProfile,
} from "@/lib/investorProfile";

const QUESTIONS = [
  "I believe studying price movements, chart patterns, and technical indicators is more useful for investment decisions than analyzing a company's financial statements.",
  "Before investing in a company, I prioritize understanding its business model, competitive advantages, revenue, profitability, and financial health.",
  "I frequently use charts, moving averages, RSI, trading volume, and other technical indicators to identify investment opportunities.",
  "I am comfortable investing in highly volatile assets if I believe they offer significantly higher potential returns.",
  "I would rather accept the possibility of substantial short-term losses than miss an investment opportunity with high potential upside.",
  "I can independently analyze a company's financial statements and use financial metrics to determine whether its stock is overvalued or undervalued.",
  "I understand how different financial instruments, market dynamics, diversification, and portfolio allocation affect investment performance.",
  "I prefer taking advantage of short-term market movements rather than holding investments for several years.",
  "I regularly monitor my investments and am willing to buy or sell positions based on relatively short-term market developments.",
  "I believe that holding fundamentally strong investments for several years is generally more effective than frequently buying and selling assets.",
];
const ANSWER_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const QUESTION_GROUPS = ["Technical analysis vs. fundamentals", "Technical analysis vs. fundamentals", "Technical analysis vs. fundamentals", "Risk tolerance", "Risk tolerance", "Expertise", "Expertise", "Short-term vs. long-term", "Short-term vs. long-term", "Short-term vs. long-term"];
const EMPTY_PROFILE: InvestorProfile = { name: "", description: "", answers: [] };

function saveProfile(profile: InvestorProfile) {
  window.localStorage.setItem(INVESTOR_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

function RatingBar({ label, score, low, high }: { label: string; score: number; low: string; high: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm tabular-nums text-text-muted">{score}/100</span>
      </div>
      <div className="relative h-2 rounded-full bg-panel-muted">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${score}%` }} />
        <span className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${score}%`, backgroundColor: "var(--color-range-marker)" }} />
      </div>
      <div className="flex justify-between text-xs text-text-muted"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<InvestorProfile>(EMPTY_PROFILE);
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  const [draftAnswer, setDraftAnswer] = useState(3);
  const [hydrated, setHydrated] = useState(false);
  const testComplete = hasCompleteInvestorTest(profile);
  const ratings = useMemo(() => testComplete ? getInvestorRatings(profile) : [], [profile, testComplete]);

  useEffect(() => {
    const saved = readInvestorProfile();
    if (saved) setProfile({ ...EMPTY_PROFILE, ...saved });
    setHydrated(true);
  }, []);

  function updateProfile(next: InvestorProfile) {
    setProfile(next);
    saveProfile(next);
  }

  function openQuestion(index: number) {
    setDraftAnswer(profile.answers[index] ?? 3);
    setQuestionIndex(index);
  }

  function startOrContinueTest() {
    const nextQuestion = testComplete
      ? 0
      : Array.from({ length: QUESTIONS.length }, (_, index) => index).find((index) => !Number.isInteger(profile.answers[index]) || profile.answers[index] < 1 || profile.answers[index] > 5) ?? 0;
    openQuestion(nextQuestion);
  }

  function saveAnswerAndContinue() {
    if (questionIndex === null) return;
    const answers = [...profile.answers];
    answers[questionIndex] = draftAnswer;
    updateProfile({ ...profile, answers });
    setQuestionIndex(questionIndex < QUESTIONS.length - 1 ? questionIndex + 1 : null);
  }

  function saveAnswerAndGoBack() {
    if (questionIndex === null) return;
    const answers = [...profile.answers];
    answers[questionIndex] = draftAnswer;
    updateProfile({ ...profile, answers });
    if (questionIndex > 0) openQuestion(questionIndex - 1);
    else setQuestionIndex(null);
  }

  if (!hydrated) return null;

  return (
    <main className="min-h-screen px-4 pb-28 pt-8 text-text-primary lg:px-10 lg:pb-12 lg:pt-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col items-center text-center lg:mb-10 lg:items-start lg:text-left">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: "var(--phone-menu-background)" }}>
            <OptionalSvgIcon name="profile" className="h-11 w-11" color="var(--phone-menu-icon)" />
          </div>
          <label className="mt-4 block w-full max-w-md lg:mt-5">
            <span className="sr-only">Your name</span>
            <input
              value={profile.name}
              onChange={(event) => updateProfile({ ...profile, name: event.target.value })}
              placeholder="Your name..."
              maxLength={80}
              className="w-full border-0 bg-transparent text-center text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted lg:text-left"
            />
          </label>
        </header>

        <section className="mb-9">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Investor style</h1>
              <p className="mt-1 text-sm text-text-muted">Answer 10 questions to build your investor profile.</p>
            </div>
            <button type="button" onClick={startOrContinueTest} className="rounded-3xl border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-panel-muted">
              {testComplete ? "Retake test" : profile.answers.length ? "Continue test" : "Start test"}
            </button>
          </div>

          {testComplete ? (
            <div className="space-y-6 rounded-3xl border border-border-subtle bg-panel px-5 py-5 lg:px-6">
              {ratings.map((rating) => <RatingBar key={rating.key} label={rating.label} score={rating.score} low={rating.low} high={rating.high} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-border-subtle bg-panel px-5 py-5 text-sm text-text-muted">
              {profile.answers.length} of {QUESTIONS.length} answers completed. Your results appear here when the test is complete.
            </div>
          )}
        </section>

        <section className="max-w-3xl">
          <label htmlFor="investor-description" className="mb-2 block text-xl font-semibold text-text-primary">Description</label>
          <p className="mb-3 text-sm text-text-muted">Tell Warrent what matters to you as an investor.</p>
          <textarea
            id="investor-description"
            value={profile.description}
            onChange={(event) => updateProfile({ ...profile, description: event.target.value.slice(0, 240) })}
            maxLength={240}
            rows={4}
            placeholder="Describe your goals, preferences, or investing approach..."
            className="w-full resize-y rounded-3xl border border-border-subtle bg-panel px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
          />
          <p className="mt-1 text-right text-xs text-text-muted">{profile.description.length}/240</p>
        </section>
      </div>

      {questionIndex !== null && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/16 px-4 py-6" style={{ backdropFilter: "blur(12px) brightness(0.97)", WebkitBackdropFilter: "blur(12px) brightness(0.97)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setQuestionIndex(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="investor-question-title" className="desktop-alert-glass smoked-glass-surface w-full max-w-xl rounded-3xl border border-white/15 p-5 shadow-2xl lg:p-7" style={{ background: "linear-gradient(145deg, rgba(8,20,20,0.48), rgba(5,15,15,0.62) 56%, rgba(3,10,10,0.54))", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 6px 22px rgba(0,0,0,0.14), inset 0 0 18px rgba(0,0,0,0.18)" }}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{QUESTION_GROUPS[questionIndex]}</p>
                <h2 id="investor-question-title" className="mt-2 text-lg font-semibold text-text-primary">Question {questionIndex + 1} of {QUESTIONS.length}</h2>
              </div>
              <button type="button" onClick={() => setQuestionIndex(null)} aria-label="Close investor style test" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text-primary">×</button>
            </div>
            <p className="text-base leading-7 text-text-primary">{QUESTIONS[questionIndex]}</p>
            <div className="mt-7">
              <input aria-label="Agreement level" type="range" min="1" max="5" step="1" value={draftAnswer} onChange={(event) => setDraftAnswer(Number(event.target.value))} className="w-full accent-accent" />
              <div className="mt-3 flex justify-between gap-2 text-[10px] text-text-muted sm:text-xs">
                {ANSWER_LABELS.map((label, index) => <span key={label} className={`max-w-16 text-center ${draftAnswer === index + 1 ? "font-semibold text-text-primary" : ""}`}>{label}</span>)}
              </div>
              <p className="mt-4 text-center text-sm font-medium text-text-primary">{ANSWER_LABELS[draftAnswer - 1]}</p>
            </div>
            <div className="mt-7 flex justify-between gap-3">
              <button type="button" onClick={saveAnswerAndGoBack} className="rounded-3xl border border-border-subtle px-4 py-2 text-sm text-text-primary">{questionIndex > 0 ? "Back" : "Cancel"}</button>
              <button type="button" onClick={saveAnswerAndContinue} className="rounded-3xl bg-accent px-5 py-2 text-sm font-semibold text-on-accent">{questionIndex === QUESTIONS.length - 1 ? "Finish" : "Next"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
