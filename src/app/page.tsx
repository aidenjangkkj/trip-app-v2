"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DayBlock from "@/components/DayBlock";
import { enrichPlanCoordinates } from "@/lib/enrichCoords";
import type { TripInput, TripPlan, TripItem } from "@/types/trip";
import { ensureItemIds } from "@/lib/ensureItemIds";

// 스피너
function Spinner() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
      <span className="text-sm text-neutral-600">일정을 생성하고 있어요…</span>
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
  {
    key: "regions",
    label: "어디로 가시나요?",
    placeholder: "예: 일본 도쿄 (여러 곳도 가능)",
    type: "text",
  },
  {
    key: "days",
    label: "여행은 며칠인가요?",
    placeholder: "예: 3",
    type: "number",
  },
  {
    key: "interests",
    label: "주요 관심사는 무엇인가요?",
    placeholder: "예: 미식, 포토스팟",
    type: "text",
  },
];

export default function Page() {
  // --- 입력 상태 (URL 동기화 제거: 전부 로컬 state) ---
  const [input, setInput] = useState<TripInput>({
    regions: [],
    days: 3,
    interests: [],
    budgetTier: "mid",
    pace: "balanced",
    travelers: 2,
    language: "ko",
  });

  // (선택) 최근 입력 로컬 저장/복원
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

  // 스텝/애니메이션
  const [stepIndex, setStepIndex] = useState(0);

  // 결과/로딩/에러
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 결과 페이징: 하루씩 보기
  const [dayCursor, setDayCursor] = useState(0);

  // 현재 스텝
  const currentStep = REQUIRED_STEPS[stepIndex];

  // 입력값을 문자열로 표시
  const currentValue = useMemo(() => {
    if (currentStep.key === "regions") return input.regions.join(", ");
    if (currentStep.key === "days") return String(input.days || "");
    if (currentStep.key === "interests") return input.interests.join(", ");
    return "";
  }, [currentStep, input]);

  // 현재 스텝 입력 업데이트
  const updateCurrent = (raw: string) => {
    if (currentStep.key === "regions") {
      const arr = parseCSV(raw);
      setInput((prev) => ({ ...prev, regions: arr }));
    } else if (currentStep.key === "days") {
      const n = Math.max(1, Number(raw || 1));
      setInput((prev) => ({ ...prev, days: Number.isFinite(n) ? n : 1 }));
    } else if (currentStep.key === "interests") {
      const arr = parseCSV(raw);
      setInput((prev) => ({ ...prev, interests: arr }));
    }
  };

  const goNextStep = () => {
    if (stepIndex < REQUIRED_STEPS.length - 1) setStepIndex((i) => i + 1);
  };
  const goPrevStep = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  // 검증은 input 기준
  const isValid = useMemo(() => {
    if (currentStep.key === "regions") return input.regions.length > 0;
    if (currentStep.key === "days") return Number.isFinite(input.days) && input.days >= 1;
    if (currentStep.key === "interests") return input.interests.length > 0;
    return false;
  }, [currentStep.key, input]);

  // 일정 생성
  const startGenerate = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setDayCursor(0);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");

      const raw = ensureItemIds(data);
      setPlan(raw);

      // 좌표 보강
      try {
        const regionHint = input.regions?.join(" ");
        const enriched = await enrichPlanCoordinates(
          raw,
          regionHint,
          input.language ?? "ko"
        );
        setPlan(enriched);
      } catch (geoErr) {
        console.warn("좌표 보강 실패", geoErr);
      }
    } catch (e: any) {
      setError(e?.message || "알 수 없는 오류");
    } finally {
      setLoading(false);
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
  }, [isValid, stepIndex]);

  // 결과 네비
  const totalDays = plan?.days?.length ?? 0;

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="max-w-3xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-8">AI 여행 일정 추천</h1>

        {/* 입력 단계 */}
        {!plan && !loading && (
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

                <div className="text-2xl md:text-3xl font-semibold mb-6">
                  {currentStep.label}
                </div>

                {/* 큰 입력창 */}
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
                      className={`h-2.5 w-2.5 rounded-full ${
                        i === stepIndex ? "bg-black" : "bg-neutral-300"
                      }`}
                      aria-label={`step-${i + 1}`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="h-[380px] flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {/* 에러 */}
        {error && !loading && !plan && (
          <p className="text-red-600 text-center mt-6">{error}</p>
        )}

        {/* 결과 (하루씩 네비게이션) */}
        {plan && !loading && (
          <div className="mt-6">
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
                  {dayCursor + 1} / {(plan?.days?.length ?? 0)}일차
                </div>
                <button
                  onClick={() =>
                    setDayCursor((c) => Math.min((plan?.days?.length ?? 1) - 1, c + 1))
                  }
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
                    onHighlight={() => {}}
                  />
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-center gap-2 mt-4">
                {plan.days.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setDayCursor(i)}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i === dayCursor ? "bg-black" : "bg-neutral-300"
                    }`}
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
