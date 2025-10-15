// trip-app-v2/src/components/DayBlock.tsx

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TripMap from "@/components/TripMap";
import type { TripPlan, TripItem, TravelMode } from "@/types/trip";

import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ✅ API 호출 유틸
import { fetchAlternatives, fetchRegenerateItem } from "@/lib/api-client";

/* ---------- 공용 스피너 ---------- */
function Spinner({ message = "처리 중…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4" aria-live="polite">
      <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-black" />
      <div className="text-sm text-neutral-700">{message}</div>
      <div className="text-xs text-neutral-500">잠시만 기다려 주세요</div>
    </div>
  );
}

/* ---------- 간단 모달 ---------- */
function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-[min(720px,92vw)] rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">{title ?? "선택"}</h4>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
            aria-label="close"
          >
            닫기 ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- 드래그 가능한 아이템 ---------- */
function SortableItem({
  item,
  selected,
  onLockToggle,
  onRegenerate,
  onAlternatives,
  onPick,
  busy,
}: {
  item: TripItem;
  selected?: boolean;
  onLockToggle: (id: string) => void;
  onRegenerate: (id: string) => void;
  onAlternatives: (id: string) => void;
  onPick: (id: string) => void;
  busy?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id!,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: selected ? "2px solid #2563eb" : undefined,
    opacity: busy ? 0.6 : 1,
    pointerEvents: busy ? ("none" as any) : "auto",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex gap-3 bg-white rounded-xl p-3 shadow border"
      onClick={() => onPick(item.id!)}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab px-2 text-neutral-500"
        aria-label="drag"
      >
        ↕
      </button>

      <div className="flex-1">
        <div className="font-medium">
          {item.place.name}{" "}
          <span className="text-xs text-neutral-500">#{item.place.category}</span>
        </div>
        <div className="text-sm text-neutral-600">{item.time ?? "-"}</div>
        {item.tips && <div className="text-sm mt-1">💡 {item.tips}</div>}

        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLockToggle(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            {item.locked ? "🔓 해제" : "🔒 고정"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            ↻ 이 블록만 재추천
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlternatives(item.id!);
            }}
            className="text-xs border rounded px-2 py-1"
          >
            ✨ 대안 3개
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onPick(item.id!);
            }}
            className="ml-auto text-xs border rounded px-2 py-1"
          >
            선택
          </button>
        </div>
      </div>

      {typeof item.place.estimatedCostKRW === "number" && (
        <div className="text-sm whitespace-nowrap self-start">
          {item.place.estimatedCostKRW.toLocaleString()}원
        </div>
      )}
    </li>
  );
}

export default function DayBlock({
  day,
  dayIndex,
  onChange,
  onHighlight,
}: {
  day: TripPlan["days"][number];
  dayIndex: number;
  onChange: (nextItems: TripItem[]) => void;
  onHighlight: (id: string) => void;
}) {
  const [mode, setMode] = useState<TravelMode>("walk");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 개별 아이템 로딩 플래그(재생성/대안 공용)
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // 대안 모달 상태
  const [altOpen, setAltOpen] = useState(false);
  const [altForId, setAltForId] = useState<string | null>(null);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);
  const [altCandidates, setAltCandidates] = useState<TripItem[]>([]);

  // 재생성 모달 상태
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenForId, setRegenForId] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenCandidate, setRegenCandidate] = useState<TripItem | null>(null);

  // id 보정
  useEffect(() => {
    const missing = day.items.some((it) => !it.id);
    if (missing) {
      const next = day.items.map((it) => ({
        id: it.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random())),
        ...it,
      })) as TripItem[];
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.items]);

  const itemIds = useMemo(() => day.items.map((i) => i.id!), [day.items]);
  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = day.items.findIndex((i) => i.id === active.id);
      const newIndex = day.items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(day.items, oldIndex, newIndex));
    },
    [day.items, onChange]
  );

  const onLockToggle = useCallback(
    (id: string) => {
      onChange(day.items.map((it) => (it.id === id ? { ...it, locked: !it.locked } : it)));
    },
    [day.items, onChange]
  );

  const onPick = useCallback(
    (id: string) => {
      setSelectedId(id ?? null);
      onHighlight(id);
    },
    [onHighlight]
  );

  /* ---------- 재생성: 모달 + 스피너 + 미리보기 ---------- */
  const onRegenerate = useCallback(
    async (id: string) => {
      const target = day.items.find((i) => i.id === id);
      if (!target) return;

      setRegenOpen(true);
      setRegenForId(id);
      setRegenLoading(true);
      setRegenError(null);
      setRegenCandidate(null);
      setBusyItemId(id);

      try {
        const nextItem = await fetchRegenerateItem(dayIndex, target);
        setRegenCandidate(nextItem);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setRegenError(msg || "재추천 실패");
      } finally {
        setRegenLoading(false);
        setBusyItemId((cur) => (cur === id ? null : cur));
      }
    },
    [day.items, dayIndex]
  );

  const confirmRegenerate = useCallback(() => {
    if (!regenForId || !regenCandidate) return;
    const next = day.items.map((it) =>
      it.id === regenForId ? { ...regenCandidate, id: regenForId } : it
    );
    onChange(next);
    setRegenOpen(false);
    setRegenForId(null);
    setRegenCandidate(null);
    setRegenError(null);
  }, [day.items, onChange, regenCandidate, regenForId]);

  const closeRegen = useCallback(() => {
    setRegenOpen(false);
    setRegenForId(null);
    setRegenCandidate(null);
    setRegenError(null);
  }, []);

  /* ---------- 대안: 모달 + 스피너 ---------- */
  const onAlternatives = useCallback(
    async (id: string) => {
      setAltOpen(true);
      setAltForId(id);
      setAltLoading(true);
      setAltError(null);
      setAltCandidates([]);
      setBusyItemId(id);

      try {
        const candidates = await fetchAlternatives(dayIndex, id);
        setAltCandidates(candidates as TripItem[]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setAltError(msg || "대안 조회 실패");
      } finally {
        setAltLoading(false);
        setBusyItemId((cur) => (cur === id ? null : cur));
      }
    },
    [dayIndex]
  );

  const chooseAlternative = useCallback(
    (idx: number) => {
      if (altForId == null || !altCandidates[idx]) return;
      const chosen = altCandidates[idx];
      const next = day.items.map((it) =>
        it.id === altForId ? { ...chosen, id: altForId, locked: false } : it
      );
      onChange(next);
      setAltOpen(false);
      setAltCandidates([]);
      setAltForId(null);
    },
    [altForId, altCandidates, day.items, onChange]
  );

  const closeAlt = useCallback(() => {
    setAltOpen(false);
    setAltCandidates([]);
    setAltError(null);
    setAltForId(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">
          Day {dayIndex + 1}
          {day.theme ? ` · ${day.theme}` : ""}
        </h3>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value as TravelMode)}
        >
          <option value="walk">도보</option>
          <option value="transit">대중교통</option>
          <option value="car">자동차</option>
        </select>
      </div>

      {/* 지도 */}
      <TripMap
        items={day.items}
        mode={mode}
        selectedId={selectedId}
        onSelect={(id) => onPick(id)}
        clustered
      />

      {/* 리스트 (드래그 정렬 가능) */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {day.items.map((it) => (
              <SortableItem
                key={it.id!}
                item={it}
                selected={selectedId === it.id}
                onLockToggle={onLockToggle}
                onRegenerate={onRegenerate}
                onAlternatives={onAlternatives}
                onPick={onPick}
                busy={busyItemId === it.id}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {/* 대안 선택 모달 */}
      <Modal open={altOpen} onClose={closeAlt} title="대안 선택">
        {altLoading && <Spinner message="대안 3개를 생성하는 중…" />}
        {!altLoading && altError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{altError}</div>
        )}
        {!altLoading && !altError && (
          <>
            {altCandidates.length === 0 ? (
              <div className="p-3 text-sm text-neutral-600">대안을 불러오지 못했습니다.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {altCandidates.map((c, i) => (
                  <div key={i} className="rounded-xl border p-3 bg-white shadow-sm flex flex-col">
                    <div className="font-medium">
                      {c.place?.name ?? "-"}{" "}
                      <span className="text-xs text-neutral-500">
                        #{c.place?.category ?? "unknown"}
                      </span>
                    </div>
                    <div className="text-sm text-neutral-600 mt-1">{c.time ?? "-"}</div>
                    {typeof c.place?.estimatedCostKRW === "number" && (
                      <div className="text-xs text-neutral-600 mt-1">
                        비용: {c.place.estimatedCostKRW.toLocaleString()}원
                      </div>
                    )}
                    {c.tips && <div className="text-xs text-neutral-700 mt-2">💡 {c.tips}</div>}
                    <button
                      onClick={() => chooseAlternative(i)}
                      className="mt-3 text-sm rounded-lg border px-3 py-2 hover:bg-neutral-50"
                    >
                      이 대안 선택
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={closeAlt}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* 재생성 모달 */}
      <Modal open={regenOpen} onClose={closeRegen} title="재생성 결과">
        {regenLoading && <Spinner message="이 블록을 재추천하는 중…" />}
        {!regenLoading && regenError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{regenError}</div>
        )}
        {!regenLoading && !regenError && regenCandidate && (
          <>
            <div className="rounded-xl border p-3 bg-white shadow-sm">
              <div className="font-medium">
                {regenCandidate.place?.name ?? "-"}{" "}
                <span className="text-xs text-neutral-500">
                  #{regenCandidate.place?.category ?? "unknown"}
                </span>
              </div>
              <div className="text-sm text-neutral-600 mt-1">
                {regenCandidate.time ?? "-"}
              </div>
              {typeof regenCandidate.place?.estimatedCostKRW === "number" && (
                <div className="text-xs text-neutral-600 mt-1">
                  비용: {regenCandidate.place.estimatedCostKRW.toLocaleString()}원
                </div>
              )}
              {regenCandidate.tips && (
                <div className="text-xs text-neutral-700 mt-2">💡 {regenCandidate.tips}</div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeRegen}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              >
                취소
              </button>
              <button
                onClick={confirmRegenerate}
                className="rounded-lg border px-3 py-2 text-sm bg-black text-white hover:bg-black/90"
              >
                이 아이템으로 교체
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
