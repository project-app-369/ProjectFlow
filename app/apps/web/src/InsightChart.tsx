import { chartTheme } from './chartTheme';
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { InsightChart } from './api';
import { usePrefs } from './state';

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const month = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/** Column or bar chart for one summary, stacked or side by side, with totals above stacks and a click that filters the register. */
export default function InsightChartView({ chart, onPick }: { chart: InsightChart; onPick?: (value: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();
  const horizontal = chart.layout === 'bar';
  const height = horizontal ? Math.max(180, chart.categories.length * 30 + 60) : 280;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current);
    const theme = chartTheme();
    const { muted, line } = theme;
    const names = chart.categories.map(k => (chart.categoryKind === 'month' ? month(k) : k));
    const totals = chart.categories.map((_, i) => chart.series.reduce((s, x) => s + (x.data[i] ?? 0), 0));
    const stacked = !!chart.stacked;
    const series: echarts.EChartsCoreOption['series'] = chart.series.map(s => ({
      name: s.name, type: 'bar', stack: stacked ? 'total' : undefined, data: s.data, itemStyle: { color: theme.seriesColor(s.color) }, barMaxWidth: horizontal ? 18 : 38, emphasis: { focus: 'series' },
      label: stacked ? { show: false } : { show: chart.categories.length <= 14, position: horizontal ? 'right' : 'top', color: muted, fontSize: 11, formatter: (p: { value: number }) => (p.value ? fmt(p.value) : '') },
    }));
    if (stacked) {
      (series as unknown[]).push({
        name: 'Total', type: 'bar', stack: 'total', data: chart.categories.map(() => 0), silent: true, tooltip: { show: false },
        label: { show: true, position: horizontal ? 'right' : 'top', color: muted, fontSize: 11, formatter: (p: { dataIndex: number }) => (totals[p.dataIndex] ? fmt(totals[p.dataIndex]) : '') },
      });
    }
    const cat = { type: 'category' as const, data: names, inverse: horizontal, axisLabel: { color: muted, fontSize: 12, hideOverlap: !horizontal, width: horizontal ? 150 : undefined, overflow: 'truncate' as const }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } };
    const val = { type: 'value' as const, axisLabel: { color: muted, fontSize: 12 }, splitLine: { lineStyle: { color: line, type: 'dashed' as const } } };
    c.setOption({
      animation: false,
      grid: { left: horizontal ? 160 : 44, right: 44, top: chart.series.length > 1 ? 30 : 14, bottom: horizontal ? 24 : 30 },
      legend: chart.series.length > 1 ? { top: 0, right: 0, data: chart.series.map(s => s.name), textStyle: { color: muted, fontSize: 12 }, itemWidth: 12, itemHeight: 8 } : undefined,
      tooltip: { ...theme.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => (typeof v === 'number' ? `${fmt(v)} ${chart.unit}` : '') },
      xAxis: horizontal ? val : cat,
      yAxis: horizontal ? cat : val,
      series,
    }, true);
    if (onPick && chart.filterKey) {
      c.on('click', (p: { dataIndex: number }) => onPick(chart.filterValues?.[p.dataIndex] ?? chart.categories[p.dataIndex]));
      c.getZr().on('mousemove', () => { c.getZr().setCursorStyle('pointer'); });
    }
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); };
  }, [chart, dark, onPick, horizontal]);

  const summary = chart.categories.map((k, i) => `${chart.categoryKind === 'month' ? month(k) : k}: ${chart.series.map(s => `${fmt(s.data[i] ?? 0)} ${s.name}`).join(', ')}`).join('; ');
  return <div className="chart"><div ref={el} role="img" aria-label={`${chart.title}. ${summary}`} style={{ height }} /></div>;
}
