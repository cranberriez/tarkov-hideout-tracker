import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type WheelEvent, type MouseEvent } from "react";
import type { MapProjection } from "./projection";
import type { PlanePoint, PlaneRect } from "./types";

/** Centre in plane units; scale in screen pixels per plane unit. */
export type View = { cx: number; cy: number; scale: number };
export type Size = { width: number; height: number };

/** Zoom limits and default in screen pixels per world metre. */
export const MIN_PX_PER_M = 0.05, MAX_PX_PER_M = 40, DEFAULT_PX_PER_M = 2;
/** A press that moves less than this (screen pixels) is a tap, not a drag. */
const TAP_PX = 4;

export const clampScale = (scale: number, unitsPerMetre: number) =>
  Math.min(MAX_PX_PER_M, Math.max(MIN_PX_PER_M, scale * unitsPerMetre)) / unitsPerMetre;

/** `focus` at the default zoom, else the whole of `art`, else the world origin. */
export function initialView(projection: MapProjection, art: PlaneRect | null, focus: PlanePoint | null, size: Size): View {
  if (focus) return { cx: focus.x, cy: focus.y, scale: DEFAULT_PX_PER_M / projection.unitsPerMetre };
  if (art && size.width && size.height) {
    const scale = clampScale(Math.min(size.width / art.width, size.height / art.height) * 0.92, projection.unitsPerMetre);
    return { cx: art.x + art.width / 2, cy: art.y + art.height / 2, scale };
  }
  const origin = projection.toPlane({ x: 0, z: 0 });
  return { cx: origin.x, cy: origin.y, scale: DEFAULT_PX_PER_M / projection.unitsPerMetre };
}

/**
 * Pan and zoom over a map frame: drag to pan (applied once a frame), wheel and double click to zoom, eased `panTo`.
 * `onPan` runs as a drag starts moving the view; `onTap` gets the element under a press that barely moved, and its plane point.
 * With `zoomAroundCentre` the wheel zooms around the frame centre instead of the cursor. `onZoom` runs when the wheel or a double click zooms.
 */
export function useMapViewport({ unitsPerMetre, zoomAroundCentre = false, onPan, onTap, onZoom }: {
  unitsPerMetre: number; zoomAroundCentre?: boolean; onPan?: () => void; onTap?: (target: Element, at: PlanePoint) => void; onZoom?: () => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<View>({ cx: 0, cy: 0, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const tween = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stopTween = useCallback(() => { if (tween.current !== null) cancelAnimationFrame(tween.current); tween.current = null; }, []);

  /** Eases the centre to a plane point, and the zoom to `scale` when given. */
  const panTo = useCallback((x: number, y: number, duration = 650, scale?: number) => {
    stopTween();
    const start = viewRef.current;
    const begin = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - begin) / duration);
      const e = 1 - (1 - t) ** 3;
      setView((current) => ({ cx: start.cx + (x - start.cx) * e, cy: start.cy + (y - start.cy) * e,
        // Eased in log space, so zooming feels even whichever way it goes.
        scale: scale === undefined ? current.scale : start.scale * (scale / start.scale) ** e }));
      tween.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    tween.current = requestAnimationFrame(step);
  }, [stopTween]);

  /** Jumps to a view, ending any pan in progress. */
  const reset = useCallback((next: View) => { stopTween(); setView(next); }, [stopTween]);

  const zoomAt = useCallback((factor: number, sx = size.width / 2, sy = size.height / 2) => setView((current) => {
    const scale = clampScale(current.scale * factor, unitsPerMetre);
    const wx = current.cx + (sx - size.width / 2) / current.scale;
    const wy = current.cy + (sy - size.height / 2) / current.scale;
    return { scale, cx: wx - (sx - size.width / 2) / scale, cy: wy - (sy - size.height / 2) / scale };
  }), [size, unitsPerMetre]);

  // Drags move the view once a frame, however many pointer events arrive in it.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef({ dx: 0, dy: 0, frame: null as number | null });
  const press = useRef<{ x: number; y: number; target: Element } | null>(null);
  useEffect(() => () => { stopTween(); if (pending.current.frame !== null) cancelAnimationFrame(pending.current.frame); }, [stopTween]);

  const endDrag = () => { drag.current = null; press.current = null; frame.current?.classList.remove("dragging"); };
  const handlers = {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      press.current = { x: event.clientX, y: event.clientY, target: event.target as Element };
      drag.current = { x: event.clientX, y: event.clientY };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      frame.current?.classList.add("dragging");
    },
    onPointerMove: (event: PointerEvent) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
      if (!dx && !dy) return;
      drag.current = { x: event.clientX, y: event.clientY };
      pending.current.dx += dx;
      pending.current.dy += dy;
      if (pending.current.frame !== null) return;
      stopTween();
      onPan?.();
      pending.current.frame = requestAnimationFrame(() => {
        const { dx, dy } = pending.current;
        pending.current = { dx: 0, dy: 0, frame: null };
        setView((current) => ({ ...current, cx: current.cx - dx / current.scale, cy: current.cy - dy / current.scale }));
      });
    },
    onPointerUp: (event: PointerEvent) => {
      const start = press.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_PX) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        onTap?.(start.target, { x: view.cx + (start.x - rect.left - size.width / 2) / view.scale, y: view.cy + (start.y - rect.top - size.height / 2) / view.scale });
      }
      endDrag();
    },
    onPointerCancel: endDrag,
    onWheel: (event: WheelEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);
      onZoom?.();
      if (zoomAroundCentre) zoomAt(factor);
      else zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
    },
    onDoubleClick: (event: MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      onZoom?.();
      zoomAt(2, event.clientX - rect.left, event.clientY - rect.top);
    },
  };

  /** Screen position (relative to the frame) of a plane point. */
  const toScreen = (x: number, y: number) => ({
    left: (x - view.cx) * view.scale + size.width / 2,
    top: (y - view.cy) * view.scale + size.height / 2,
  });

  return { frame, size, view, panTo, reset, zoomAt, toScreen, handlers, dragging: () => drag.current !== null };
}

export type MapViewport = ReturnType<typeof useMapViewport>;
