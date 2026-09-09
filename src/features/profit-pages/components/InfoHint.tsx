"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, TriangleAlert } from "lucide-react";

export function InfoHint({
  title,
  children,
  tone = "neutral",
  onShow,
  compact = false,
}: {
  title: string;
  children?: React.ReactNode;
  tone?: "neutral" | "warning";
  onShow?: () => void;
  compact?: boolean;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  function show(event?: React.SyntheticEvent) {
    event?.stopPropagation();
    onShow?.();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(compact ? 128 : 288, window.innerWidth - 16);
    const left = Math.max(
      8,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - 8,
      ),
    );
    const placeAbove = rect.top > 170;
    setPosition({
      left,
      width,
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  }
  return (
    <>
      <span
        ref={triggerRef}
        data-isolated-hover="true"
        tabIndex={0}
        aria-label={title}
        onMouseEnter={show}
        onMouseMove={(event) => event.stopPropagation()}
        onMouseLeave={() => setPosition(null)}
        onFocus={show}
        onBlur={() => setPosition(null)}
        className={`flex size-3.5 shrink-0 cursor-help items-center justify-center outline-none transition ${tone === "warning" ? "text-warning/90 hover:text-warning focus:text-warning" : "text-muted-foreground hover:text-foreground focus:text-foreground"}`}
      >
        {compact && tone === "warning" ? <TriangleAlert className="size-3" /> : <Info className="size-3" />}
      </span>
      {position &&
        createPortal(
          <span
            role="tooltip"
            className={`pointer-events-none fixed z-[120] block rounded-md border border-highlight/15 bg-[var(--background)] ${compact ? "px-2 py-1.5" : "p-3"} text-left shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]`}
            style={position}
          >
            <span
              className={`block ${compact ? "text-[11px]" : "text-[10px] font-bold uppercase tracking-wide"} ${tone === "warning" ? "text-warning" : "text-brand"}`}
            >
              {title}
            </span>
            {children && <span className="mt-1.5 block text-[11px] leading-relaxed text-foreground/80">
              {children}
            </span>}
          </span>,
          document.body,
        )}
    </>
  );
}
