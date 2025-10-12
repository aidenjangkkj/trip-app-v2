"use client";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TripItem } from "@/types/trip";

function Row({ item, selected, onSelect, onToggleLock, onAskAlternatives }: {
  item: TripItem; selected?: boolean;
  onSelect?: () => void;
  onToggleLock?: () => void;
  onAskAlternatives?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id! });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}
         className={`flex items-start gap-3 p-3 rounded-xl border bg-white ${selected ? "ring-2 ring-amber-400" : ""}`}>
      <button className="cursor-grab text-neutral-400" {...attributes} {...listeners}>≡</button>
      <div className="flex-1" onClick={onSelect}>
        <div className="font-medium">{item.place.name} <span className="text-xs text-neutral-500">#{item.place.category}</span></div>
        {item.tips && <div className="text-sm text-neutral-600 mt-0.5">💡 {item.tips}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onAskAlternatives} className="text-sm px-2 py-1 border rounded-md">대안</button>
        <button onClick={onToggleLock} className={`text-sm px-2 py-1 border rounded-md ${item.locked ? "bg-amber-100" : ""}`}>
          {item.locked ? "🔒" : "🔓"}
        </button>
      </div>
    </div>
  );
}

export default function ItineraryList({
  items, selectedId, onSelect, onReorder, onToggleLock, onAskAlternatives
}:{
  items: TripItem[]; selectedId?: string|null;
  onSelect: (id: string)=> void;
  onReorder: (next: TripItem[])=> void;
  onToggleLock: (id: string)=> void;
  onAskAlternatives: (id: string)=> void;
}) {
  const ids = items.map(it => it.id!);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const next = arrayMove(items, oldIndex, newIndex);
    onReorder(next);
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {items.map(it=>(
            <Row key={it.id} item={it} selected={selectedId===it.id}
                 onSelect={()=>onSelect(it.id!)}
                 onToggleLock={()=>onToggleLock(it.id!)}
                 onAskAlternatives={()=>onAskAlternatives(it.id!)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
