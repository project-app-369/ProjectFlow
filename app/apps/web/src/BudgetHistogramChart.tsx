import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { BudgetHistogram } from './api';
import { usePrefs } from './state';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const PALETTE = ['#343c78', '#00877d', '#c98f2c', '#bc5660', '#6b7bd6', '#5aa985', '#8a5aa8', '#8d97d6'];
const label = (start: string, by: 'week' | 'month') =>
  new Date(`${start}T12:00:00Z`).toLocaleDateString('en-GB', by === 'week' ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { month: 'short', year: '2-digit', timeZone: 'UTC' });
const fmt = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });

/** Manhours per week or month, stacked by WBS area or discipline, with the cumulative total as a line on the right axis. */
export default function BudgetHistogramChart({ data }: { data: BudgetHistogram }) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();

  useEffect(() => {
    if (!el.current) return;
    const chart = echarts.init(el.current);
    const muted = dark ? '#a3b0c4' : '#5d697c';
    const line = dark ? '#2c3549' : '#e3e8f0';
    const x = data.periods.map(p => label(p.start, data.by));
    chart.setOption({
      animation: false,
      color: PALETTE,
      grid: { left: 56, right: 56, top: 64, bottom: 52 },
      legend: { type: 'scroll', top: 0, left: 0, right: 0, textStyle: { color: muted, fontSize: 12 }, itemWidth: 12, itemHeight: 8 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const items = raw as { dataIndex: number; seriesName: string; value: number; marker: string; seriesType: string }[];
          const p = data.periods[items[0].dataIndex];
          const rows = items.filter(i => i.seriesType === 'bar' && i.value > 0).map(i => `${i.marker}${i.seriesName}: <b>${fmt(i.value)} h</b>`);
          return `<b>${label(p.start, data.by)}${data.by === 'week' ? ` – ${label(p.end, 'week')}` : ''}</b><br/>${rows.join('<br/>')}<br/>Total: <b>${fmt(p.total)} h</b><br/>Cumulative: <b>${fmt(data.cumulative[items[0].dataIndex])} h</b>`;
        },
      },
      xAxis: { type: 'category', data: x, axisLabel: { color: muted, fontSize: 12, hideOverlap: true, rotate: x.length > 18 ? 45 : 0 }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', name: 'Manhours', nameTextStyle: { color: muted, fontSize: 12 }, axisLabel: { color: muted, fontSize: 12, formatter: (v: number) => fmt(v) }, splitLine: { lineStyle: { color: line, type: 'dashed' } } },
        { type: 'value', name: 'Cumulative', nameTextStyle: { color: muted, fontSize: 12 }, axisLabel: { color: muted, fontSize: 12, formatter: (v: number) => fmt(v) }, splitLine: { show: false } },
      ],
      series: [
        ...data.groups.map(g => ({
          name: g.label, type: 'bar' as const, stack: 'hours', barMaxWidth: 36,
          data: data.periods.map(p => p.byGroup[g.key] ?? 0),
        })),
        { name: 'Cumulative', type: 'line' as const, yAxisIndex: 1, showSymbol: false, data: data.cumulative, lineStyle: { color: dark ? '#e6ebf3' : '#1d2b40', width: 2 }, itemStyle: { color: dark ? '#e6ebf3' : '#1d2b40' } },
      ],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [data, dark]);

  return (
    <div className="chart">
      <div ref={el} role="img" aria-label={`Manhour histogram per ${data.by}, ${fmt(data.scheduledHours)} scheduled hours, stacked by ${data.group === 'wbs' ? 'WBS area' : 'discipline'}`} style={{ height: 340 }} />
    </div>
  );
}
