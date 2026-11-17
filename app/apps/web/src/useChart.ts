import * as echarts from 'echarts/core';
import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * One ECharts instance per mounted chart. The chart is created once and resized with its box; new data is applied with
 * `setOption`, so a refetch or a theme change updates the drawing in place instead of disposing and rebuilding the canvas
 * (which blanked the chart for a frame and replayed its entrance). Returns null until the chart exists.
 */
export function useChart(box: RefObject<HTMLDivElement | null>): echarts.ECharts | null {
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const made = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const c = echarts.init(el);
    made.current = c;
    setChart(c);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => { ro.disconnect(); c.dispose(); made.current = null; setChart(null); };
  }, [box]);
  return chart;
}
