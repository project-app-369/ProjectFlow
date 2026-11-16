import { useLayoutEffect, useRef, type RefObject } from 'react';

/** A zoom slider for a time axis: minus, a log-scale range input (the same step feels the same at every zoom) and plus. */
export function ZoomSlider({ value, min, max, onChange, label = 'Zoom the time span' }: { value: number; min: number; max: number; onChange: (v: number) => void; label?: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const t = Math.round((Math.log(value / min) / Math.log(max / min)) * 100);
  return (
    <div className="zoom-slider" role="group" aria-label={label}>
      <button type="button" className="icon-btn" aria-label="Zoom out" title="Zoom out" onClick={() => onChange(clamp(value / 1.3))}>−</button>
      <input type="range" min={0} max={100} step={1} value={Math.min(100, Math.max(0, t))} aria-label={label} title={label} onChange={e => onChange(clamp(min * Math.pow(max / min, Number(e.target.value) / 100)))} />
      <button type="button" className="icon-btn" aria-label="Zoom in" title="Zoom in" onClick={() => onChange(clamp(value * 1.3))}>+</button>
    </div>
  );
}

/**
 * Keeps what is in the middle of a scrolling timeline in the middle while it is zoomed. `pxPerDay` is the current scale; the
 * returned function is the setter to use, and `leftWidth` is the sticky names column that covers the start of the scroller.
 */
export function useZoomAnchor(scroller: RefObject<HTMLElement | null>, pxPerDay: number, setPxPerDay: (v: number) => void, leftWidth: number) {
  const anchor = useRef<number | null>(null);
  const zoomTo = (next: number) => {
    const el = scroller.current;
    if (el && next !== pxPerDay) anchor.current = (el.scrollLeft + (el.clientWidth - leftWidth) / 2) / pxPerDay;
    setPxPerDay(next);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && anchor.current !== null) el.scrollLeft = Math.max(0, anchor.current * pxPerDay - (el.clientWidth - leftWidth) / 2);
    anchor.current = null;
  }, [pxPerDay, leftWidth, scroller]);
  return zoomTo;
}
