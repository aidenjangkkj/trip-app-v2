// trip-app-v2/src/app/page.tsx

"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DayBlock from "@/components/DayBlock";
import { enrichPlanCoordinates } from "@/lib/enrichCoords";
import type { TripInput, TripPlan, TripItem } from "@/types/trip";
import { ensureItemIds } from "@/lib/ensureItemIds";

// 스피너
function Spinner({ message = "일정을 생성하고 있어요…" }: { message?: string }) {
  const tips = useRef<string[]>([
    "도시별 인기 스팟을 수집 중…",
    "이동 동선을 최소화하고 있어요",
    "AI가 맛집/카페 리뷰를 요약 중…",
    "지도 좌표를 정밀 보정 중…",
    "비 오는 날 대안 코스를 고려해요",
  ]).current;

  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-2" aria-live="polite">
      <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
      <div className="text-sm text-neutral-700">{message}</div>
      <div className="text-xs text-neutral-500">{tips[tipIdx]}</div>
    </div>
  );
}

// 쉼표/공백용 파서
function parseCSV(s: string): string[] {
  return s
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

type StepKey = "regions" | "days" | "interests";
const REQUIRED_STEPS: {
  key: StepKey;
  label: string;
  placeholder: string;
  type: "text" | "number";
}[] = [
  { key: "regions", label: "어디로 가시나요?", placeholder: "예: 일본 도쿄 (여러 곳도 가능)", type: "text" },
  { key: "days", label: "여행은 며칠인가요?", placeholder: "예: 3", type: "number" },
  { key: "interests", label: "주요 관심사는 무엇인가요?", placeholder: "예: 미식, 포토스팟", type: "text" },
];

export default function Page() {
  // 입력 상태
  const [input, setInput] = useState<TripInput>({
    regions: [],
    days: 3,
    interests: [],
    budgetTier: "mid",
    pace: "balanced",
    travelers: 2,
    language: "ko",
  });

  // draft 입력 상태(사용자 타이핑 그대로 보존)
  const [draft, setDraft] = useState<{ regions: string; days: string; interests: string }>({
    regions: "",
    days: "",
    interests: "",
  });

  // 로컬 저장/복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem("trip.input.v1");
      if (raw) setInput((v) => ({ ...v, ...JSON.parse(raw) }));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("trip.input.v1", JSON.stringify(input));
    } catch {}
  }, [input]);

  // 스텝
  const [stepIndex, setStepIndex] = useState(0);

  // 결과/로딩/에러
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const requestIdRef = useRef(0);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 하루 보기 페이징
  const [dayCursor, setDayCursor] = useState(0);

  const currentStep = REQUIRED_STEPS[stepIndex];

  // 현재 표시 값(draft 기준)
  const currentValue = useMemo(() => {
    if (currentStep.key === "regions") return draft.regions;
    if (currentStep.key === "days") return draft.days;
    if (currentStep.key === "interests") return draft.interests;
    return "";
  }, [currentStep, draft]);

  // 스텝 변경 시 draft 초기화
  useEffect(() => {
    if (currentStep.key === "regions") {
      setDraft((d) => ({ ...d, regions: input.regions.join(", ") }));
    } else if (currentStep.key === "days") {
      setDraft((d) => ({ ...d, days: String(input.days ?? "") }));
    } else if (currentStep.key === "interests") {
      setDraft((d) => ({ ...d, interests: input.interests.join(", ") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // 입력 업데이트(draft만 갱신)
  const updateCurrent = (raw: string) => {
    if (currentStep.key === "regions") setDraft((d) => ({ ...d, regions: raw }));
    else if (currentStep.key === "days") setDraft((d) => ({ ...d, days: raw }));
    else if (currentStep.key === "interests") setDraft((d) => ({ ...d, interests: raw }));
  };

  // draft -> input 커밋
  const commitDraftFor = (key: StepKey) => {
    setInput((prev) => {
      if (key === "regions") return { ...prev, regions: parseCSV(draft.regions) };
      if (key === "days") {
        const n = Math.max(1, Number(draft.days || 1));
        return { ...prev, days: Number.isFinite(n) ? n : 1 };
      }
      if (key === "interests") return { ...prev, interests: parseCSV(draft.interests) };
      return prev;
    });
  };

  const goNextStep = useCallback(() => {
    commitDraftFor(currentStep.key);
    setStepIndex((i) => (i < REQUIRED_STEPS.length - 1 ? i + 1 : i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.key]);

  const goPrevStep = useCallback(() => {
    commitDraftFor(currentStep.key);
    setStepIndex((i) => (i > 0 ? i - 1 : i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.key]);

  // 유효성(draft 기준)
  const isValid = useMemo(() => {
    if (currentStep.key === "regions") return parseCSV(draft.regions).length > 0;
    if (currentStep.key === "days") {
      const n = Number(draft.days);
      return Number.isFinite(n) && n >= 1;
    }
    if (currentStep.key === "interests") return parseCSV(draft.interests).length > 0;
    return false;
  }, [currentStep.key, draft]);

  // 일정 생성
  const startGenerate = async () => {
    const finalInput: TripInput = {
      ...input,
      regions: parseCSV(draft.regions),
      days: Math.max(1, Number(draft.days || 1)) || 1,
      interests: parseCSV(draft.interests),
    };
    setInput(finalInput);

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setGenerating(true);
    setEnhancing(false);
    setError(null);
    setPlan(null);
    setDayCursor(0);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finalInput),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "생성 실패");

      const rawPlan = ensureItemIds(data);
      if (requestIdRef.current !== requestId) return;

      setPlan(rawPlan);
      setGenerating(false);

      const regionHint = finalInput.regions?.join(" ");
      const language = finalInput.language ?? "ko";

      void (async () => {
        if (requestIdRef.current !== requestId) return;
        setEnhancing(true);
        try {
          const enriched = await enrichPlanCoordinates(rawPlan, regionHint, language);
          if (requestIdRef.current !== requestId) return;
          setPlan(enriched);
        } catch (geoErr) {
          if (requestIdRef.current === requestId) {
            console.warn("좌표 보강 실패", geoErr);
          }
        } finally {
          if (requestIdRef.current === requestId) {
            setEnhancing(false);
          }
        }
      })();
    } catch (e: unknown) {
      if (requestIdRef.current !== requestId) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "알 수 없는 오류");
      setGenerating(false);
    }
  };

  // Enter로 다음 단계
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!isValid) return;
        if (stepIndex < REQUIRED_STEPS.length - 1) goNextStep();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isValid, stepIndex, goNextStep]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-8">AI 여행 일정 추천</h1>

        {/* 입력 단계 */}
        {!plan && !generating && (
          <div className="h-[70vh] flex flex-col items-center justify-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="w-full max-w-2xl"
              >
                <div className="text-sm text-neutral-500 mb-2">
                  {stepIndex + 1} / {REQUIRED_STEPS.length}
                </div>

                <div className="text-2xl md:text-3xl font-semibold mb-6">{currentStep.label}</div>

                {currentStep.type === "text" && (
                  <input
                    className="w-full text-center text-2xl md:text-3xl bg-transparent outline-none focus:outline-none focus:ring-0 placeholder:text-neutral-400 py-3"
                    value={currentValue}
                    onChange={(e) => updateCurrent(e.target.value)}
                    placeholder={currentStep.placeholder}
                    autoFocus
                  />
                )}
                {currentStep.type === "number" && (
                  <input
                    type="number"
                    min={1}
                    className="w-full text-center text-2xl md:text-3xl bg-transparent outline-none focus:outline-none focus:ring-0 placeholder:text-neutral-400 py-3"
                    value={currentValue}
                    onChange={(e) => updateCurrent(e.target.value)}
                    placeholder={currentStep.placeholder}
                    autoFocus
                  />
                )}

                <div className="flex items-center justify-between mt-8">
                  <button
                    type="button"
                    onClick={goPrevStep}
                    disabled={stepIndex === 0}
                    className="px-4 py-2 text-sm border-b border-dashed border-neutral-400 disabled:opacity-40"
                  >
                    이전
                  </button>

                  {stepIndex < REQUIRED_STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNextStep}
                      disabled={!isValid}
                      className="px-5 py-2 text-sm border-b border-black disabled:opacity-40"
                    >
                      다음
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startGenerate}
                      disabled={!isValid}
                      className="px-5 py-2 text-sm border-b border-black disabled:opacity-40"
                    >
                      일정 생성
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mt-5">
                  {REQUIRED_STEPS.map((s, i) => (
                    <button
                      key={s.key}
                      onClick={() => setStepIndex(i)}
                      className={`h-2.5 w-2.5 rounded-full ${i === stepIndex ? "bg-black" : "bg-neutral-300"}`}
                      aria-label={`step-${i + 1}`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* 로딩 */}
        {generating && (
          <div className="h-[380px] flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/* 에러 */}
        {error && !generating && !plan && (
          <p className="text-red-600 text-center mt-6">{error}</p>
        )}

        {/* 결과 (하루씩 네비게이션) */}
        {plan && !generating && (
          <div className="mt-6">
            {enhancing && (
              <div className="my-4">
                <Spinner message="장소 좌표를 정리하는 중이에요…" />
              </div>
            )}

            <div className="bg-white rounded-2xl shadow p-4 border">
              <h2 className="text-xl font-semibold">{plan.title}</h2>
              {plan.summary?.length ? (
                <ul className="list-disc pl-5 mt-2 text-neutral-700">
                  {plan.summary.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setDayCursor((c) => Math.max(0, c - 1))}
                  disabled={dayCursor <= 0}
                  className="px-3 py-2 rounded-xl border disabled:opacity-40"
                >
                  ← 이전 일정
                </button>
                <div className="text-sm text-neutral-600">
                  {dayCursor + 1} / {plan?.days?.length ?? 0}일차
                </div>
                <button
                  onClick={() => setDayCursor((c) => Math.min((plan?.days?.length ?? 1) - 1, c + 1))}
                  disabled={dayCursor >= (plan?.days?.length ?? 1) - 1}
                  className="px-3 py-2 rounded-xl border disabled:opacity-40"
                >
                  다음 일정 →
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={dayCursor}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                >
                  <DayBlock
                    day={plan.days[dayCursor]}
                    dayIndex={dayCursor}
                    onChange={(nextItems: TripItem[]) => {
                      const copy: TripPlan = JSON.parse(JSON.stringify(plan));
                      copy.days[dayCursor].items = nextItems;
                      setPlan(copy);
                    }}
                    onHighlight={()=>{}}
                  />
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-center gap-2 mt-4">
                {plan.days.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setDayCursor(i)}
                    className={`h-2.5 w-2.5 rounded-full ${i === dayCursor ? "bg-black" : "bg-neutral-300"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 간단 페이드 keyframes */}
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 220ms ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}