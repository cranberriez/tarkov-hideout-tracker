"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function InfoHint({
  title,
  children,
  tone = "neutral",
  onShow,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "neutral" | "warning";
  onShow?: () => void;
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
    const width = Math.min(288, window.innerWidth - 16);
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
        className={`flex size-3.5 shrink-0 cursor-help items-center justify-center outline-none transition ${tone === "warning" ? "text-amber-300/90 hover:text-amber-200 focus:text-amber-200" : "text-muted-foreground hover:text-foreground focus:text-foreground"}`}
      >
        <Info className="size-3" />
      </span>
      {position &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[120] block rounded-md border border-white/15 bg-[#05070a] p-3 text-left shadow-[0_18px_55px_rgba(0,0,0,0.8)]"
            style={position}
          >
            <span
              className={`block text-[10px] font-bold uppercase tracking-wide ${tone === "warning" ? "text-amber-300" : "text-tarkov-green"}`}
            >
              {title}
            </span>
            <span className="mt-1.5 block text-[11px] leading-relaxed text-foreground/80">
              {children}
            </span>
          </span>,
          document.body,
        )}
    </>
  );
}
