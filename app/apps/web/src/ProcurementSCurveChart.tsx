import { ZOOM_BOTTOM, chartTheme, timeZoom } from './chartTheme';
import { LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { ProcurementCurve } from './api';
import { usePrefs } from './state';

echarts.use([DataZoomComponent, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

const monthLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Weekly cumulative progress: plan, forecast and actual, with the cut-off marked. */
export default function ProcurementSCurveChart({ curve }: { curve: ProcurementCurve }) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current);
    const theme = chartTheme();
    const { muted, line } = theme;
    const teal = theme.teal;
    const cut = curve.dates.findIndex(d => d > curve.cutoff);
    const cutIndex = cut === -1 ? curve.dates.length - 1 : Math.max(0, cut - 1);
    const series = (name: string, data: (number | null)[], color: string, dashed = false, width = 2, mark = false) => ({
      name, type: 'line' as const, showSymbol: false, smooth: false, connectNulls: false, data,
      lineStyle: { color, width, type: dashed ? ('dashed' as const) : ('solid' as const) }, itemStyle: { color },
      ...(mark ? { markLine: { symbol: 'none', silent: true, label: { formatter: 'Cut-off', color: muted, fontSize: 11 }, lineStyle: { color: muted, type: 'dotted' as const }, data: [{ xAxis: cutIndex }] } } : {}),
    });
    chart.setOption({
      animation: false,
      grid: { left: 40, right: 16, top: 28, bottom: ZOOM_BOTTOM },
      dataZoom: timeZoom(theme),
      legend: { top: 0, right: 0, textStyle: { color: muted, fontSize: 12 }, itemWidth: 14, itemHeight: 6 },
      tooltip: { ...theme.tooltip, trigger: 'axis', valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—') },
      xAxis: { type: 'category', data: curve.dates, axisLabel: { color: muted, fontSize: 12, hideOverlap: true, formatter: (v: string) => monthLabel(v) }, axisPointer: { label: { formatter: (p: { value: string | number }) => dayLabel(String(p.value)) } }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: muted, fontSize: 12, formatter: '{value}%' }, splitLine: { lineStyle: { color: line, type: 'dashed' } } },
      series: [series('Plan', curve.plan, theme.plan, false, 2, true), series('Forecast', curve.forecast, theme.forecast, true), series('Actual', curve.actual, teal, false, 2.5)],
    }, true);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [curve, dark]);

  const name = `${curve.facility ?? ''} ${curve.scope ?? ''}`.trim();
  return <div className="chart"><div ref={el} role="img" aria-label={`Procurement S-curve for ${name}, plan versus forecast and actual`} style={{ minHeight: 340 }} /></div>;
}
