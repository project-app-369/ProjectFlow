import { chartTheme } from './chartTheme';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { ScurvePoint } from './api';
import { usePrefs } from './state';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const monthLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

export default function SCurveChart({ points }: { points: ScurvePoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current);
    const theme = chartTheme();
    const { muted, line } = theme;
    const teal = theme.teal;
    const series = (name: string, key: 'plan' | 'forecast' | 'actual', color: string, dashed = false, width = 2) => ({
      name, type: 'line' as const, showSymbol: false, smooth: false, connectNulls: false,
      data: points.map(p => p[key]),
      lineStyle: { color, width, type: dashed ? ('dashed' as const) : ('solid' as const) },
      itemStyle: { color },
    });
    chart.setOption({
      animation: false,
      grid: { left: 40, right: 16, top: 28, bottom: 28 },
      legend: { top: 0, right: 0, textStyle: { color: muted, fontSize: 12 }, itemWidth: 14, itemHeight: 6 },
      tooltip: { ...theme.tooltip, trigger: 'axis', valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—') },
      xAxis: { type: 'category', data: points.map(p => monthLabel(p.date)), axisLabel: { color: muted, fontSize: 12, interval: 'auto', hideOverlap: true }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: muted, fontSize: 12, formatter: '{value}%' }, splitLine: { lineStyle: { color: line, type: 'dashed' } } },
      series: [series('Plan', 'plan', theme.plan), series('Forecast', 'forecast', theme.forecast, true), series('Actual', 'actual', teal, false, 2.5)],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [points, dark]);

  return <div className="chart"><div ref={el} role="img" aria-label="Procurement S-curve, plan versus forecast and actual" style={{ height: 260 }} /></div>;
}
