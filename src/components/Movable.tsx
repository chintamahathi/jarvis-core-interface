import { Check, Move } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Offset = { x: number; y: number };

const STORE_KEY = "jarvis.layout.offsets";
const RESET_EVENT = "jarvis-layout-reset";

function readStore(): Record<string, Offset> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}") as Record<string, Offset>;
  } catch {
    return {};
  }
}

function writeOffset(id: string, offset: Offset) {
  const store = readStore();
  store[id] = offset;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function resetLayout() {
  window.localStorage.removeItem(STORE_KEY);
  window.dispatchEvent(new Event(RESET_EVENT));
}

export function Movable({
  id,
  className,
  children,
}: {
  id: string;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = readStore()[id];
    if (stored) setOffset(stored);
    const onReset = () => setOffset({ x: 0, y: 0 });
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, [id]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest("button,a,input,select,textarea")) return;
      if (event.button !== 0) return;
      event.preventDefault();
      start.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
      setDragging(true);
      setSaved(false);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin) return;
    setOffset({ x: origin.ox + event.clientX - origin.px, y: origin.oy + event.clientY - origin.py });
  }, []);

  const endDrag = useCallback(() => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    writeOffset(id, offset);
  }, [id, offset]);

  const savePosition = useCallback(() => {
    writeOffset(id, offset);
    setSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
  }, [id, offset]);

  return (
    <div
      className={cn("movable", dragging && "movable-dragging", className)}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="movable-tools" aria-hidden={false}>
        <span className="movable-tool movable-tool-move" title="Drag to move">
          <Move size={11} strokeWidth={2} />
          <em>MOVE</em>
        </span>
        <button
          type="button"
          className={cn("movable-tool movable-tool-save", saved && "movable-tool-saved")}
          onClick={savePosition}
          title="Save position"
        >
          <Check size={11} strokeWidth={2.4} />
          <em>{saved ? "SAVED" : "SAVE"}</em>
        </button>
      </div>
      {children}
    </div>
  );
}
