import { ZOOM_BOTTOM, chartTheme, timeZoom } from './chartTheme';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { useChart } from './useChart';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { Milestone, ScurvePoint } from './api';
import { fmtDate } from './format';
import { isWeekly } from './scurveTime';
import { usePrefs } from './state';

echarts.use([DataZoomComponent, BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkPointComponent, LabelLayout, CanvasRenderer]);

const monthLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
const day = (d: string) => Date.parse(`${d}T12:00:00Z`) / 86_400_000;
const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A date as a position on the category axis, between the two cut-offs that surround it. */
function position(points: ScurvePoint[], date: string): number {
  const t = day(date);
  if (t <= day(points[0].date)) return 0;
  const last = points.length - 1;
  if (t >= day(points[last].date)) return last;
  let i = 0;
  while (day(points[i + 1].date) < t) i++;
  const a = day(points[i].date), b = day(points[i + 1].date);
  return i + (b === a ? 0 : (t - a) / (b - a));
}

/** Plan progress at a position, so a milestone sits on the plan curve at its date. */
function planAt(points: ScurvePoint[], at: number): number {
  const i = Math.min(Math.floor(at), points.length - 1), j = Math.min(i + 1, points.length - 1);
  const a = points[i].plan ?? 0, b = points[j].plan ?? a;
  return a + (b - a) * (at - i);
}

/** Progress made in each week (plan and actual): the gap between a cut-off and the one before it. */
function weeklyBars(points: ScurvePoint[]) {
  const plan: (number | null)[] = points.map(() => null), actual: (number | null)[] = points.map(() => null);
  let prevPlan = 0, prevActual = 0, max = 0;
  points.forEach((p, i) => {
    if (p.plan != null) { plan[i] = Math.round((p.plan - prevPlan) * 100) / 100; prevPlan = p.plan; max = Math.max(max, plan[i]!); }
    if (p.actual != null) { actual[i] = Math.round((p.actual - prevActual) * 100) / 100; prevActual = p.actual; max = Math.max(max, actual[i]!); }
  });
  return { plan, actual, max };
}

/** Progress made in each calendar month (plan and actual), as the gap between the cumulative curve at the month's last cut-off and the one before. */
function monthlyBars(points: ScurvePoint[]) {
  const plan: (number | null)[] = points.map(() => null), actual: (number | null)[] = points.map(() => null);
  let prevPlan = 0, prevActual = 0, max = 0;
  points.forEach((p, i) => {
    const key = p.date.slice(0, 7), last = i === points.length - 1 || points[i + 1].date.slice(0, 7) !== key;
    if (!last) return;
    let a = -1;
    for (let j = i; j >= 0 && points[j].date.slice(0, 7) === key; j--) if (points[j].actual != null) { a = j; break; }
    if (p.plan != null) { plan[i] = Math.round((p.plan - prevPlan) * 10) / 10; prevPlan = p.plan; max = Math.max(max, plan[i]!); }
    if (a >= 0) { actual[i] = Math.round((points[a].actual! - prevActual) * 10) / 10; prevActual = points[a].actual!; max = Math.max(max, actual[i]!); }
  });
  return { plan, actual, max };
}

const milestoneDate = (m: Milestone) => m.actual ?? m.forecast ?? m.planBaseline;

interface Props {
  points: ScurvePoint[];
  /** Major milestones of the scope, drawn on the plan curve. */
  milestones?: Milestone[];
  /** The reporting cut-off, drawn as a vertical line. */
  cutoff?: string | null;
  /** The larger copy in the dialog: milestone names are written on the chart. */
  expanded?: boolean;
  /** Progress implied by the baseline and the working schedule at the same dates as `points`, drawn as two dashed lines to check the plan. */
  schedule?: { date: string; baseline: number; working: number }[] | null;
}

export default function SCurveChart({ points, milestones = [], cutoff, expanded = false, schedule = null }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();
  const chart = useChart(el);

  useEffect(() => {
    if (!chart || !points.length) return;
    const theme = chartTheme();
    const { muted, line, ink } = theme;
    const fs = expanded ? 13 : 12;
    const series = (name: string, key: 'plan' | 'forecast' | 'actual', color: string, dashed = false, width = 2) => ({
      name, type: 'line' as const, showSymbol: false, smooth: false, connectNulls: false, z: 3,
      data: points.map(p => p[key]),
      lineStyle: { color, width, type: dashed ? ('dashed' as const) : ('solid' as const) },
      itemStyle: { color },
    });

    const weekly = isWeekly(points);
    const cutAt = cutoff ? position(points, cutoff) : null;
    let lastActual = -1;
    points.forEach((p, i) => { if (p.actual != null) lastActual = i; });
    // the forecast is labelled where the actual stops, so the two can be compared; a forecast without an actual is labelled at its own end
    const lastForecast = lastActual >= 0 && points[lastActual].forecast != null ? lastActual : points.reduce((n, p, i) => (p.forecast != null ? i : n), -1);

    const actual = {
      ...series('Actual', 'actual', theme.teal, false, 2.5),
      markLine: cutAt == null ? undefined : {
        silent: true, symbol: 'none',
        lineStyle: { color: ink, type: 'dashed' as const, width: 1.2, opacity: 0.75 },
        label: { show: true, position: 'end' as const, rotate: 0, distance: 4, formatter: `Cut-off ${fmtDate(cutoff!)}`, color: ink, fontSize: fs - 1, fontWeight: 600 },
        data: [{ xAxis: Math.round(cutAt) }],
      },
      markPoint: lastActual < 0 ? undefined : {
        symbol: 'circle', symbolSize: 11, silent: true,
        itemStyle: { color: theme.teal, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'top' as const, distance: 10, formatter: `Actual ${points[lastActual].actual!.toFixed(1)}%`, color: theme.teal, fontSize: fs, fontWeight: 700 },
        data: [{ coord: [lastActual, points[lastActual].actual] }],
      },
    };
    const forecast = {
      ...series('Forecast', 'forecast', theme.forecast, true),
      markPoint: lastForecast < 0 ? undefined : {
        symbol: 'circle', symbolSize: 8, silent: true,
        itemStyle: { color: theme.forecast, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, position: 'bottom' as const, distance: 8, formatter: `Forecast ${points[lastForecast].forecast!.toFixed(1)}%`, color: theme.forecast, fontSize: fs, fontWeight: 600 },
        data: [{ coord: [lastForecast, points[lastForecast].forecast] }],
      },
    };

    const tone = (m: Milestone) => theme.seriesColor(m.actual ? 'done' : m.status === 'Overdue' ? 'critical' : 'open');
    const marks = milestones.flatMap(m => {
      const d = milestoneDate(m);
      if (!d) return [];
      const x = position(points, d);
      const y = Math.round(planAt(points, x) * 10) / 10;
      // on the steep part the space above-left of a point is free; on the flat start and the flat end it is above the point
      const rising = y > 15 && y < 92;
      return [{ value: [Math.round(x * 100) / 100, y], m, itemStyle: { color: tone(m), borderColor: '#fff', borderWidth: 1.5 }, label: rising ? { position: 'left' as const, distance: 9 } : { position: 'top' as const, distance: 7, ...(x / (points.length - 1) > 0.8 ? { align: 'right' as const } : {}) } }];
    });
    const milestoneSeries = {
      name: 'Major milestones', type: 'scatter' as const, z: 5, symbol: 'diamond', symbolSize: expanded ? 13 : 10, data: marks,
      label: expanded
        ? { show: true, position: 'top' as const, fontSize: 11, color: ink, textBorderColor: theme.tooltip.backgroundColor, textBorderWidth: 3, formatter: (p: { data: { m: Milestone } }) => { const t = p.data.m.description.replace(/ \(.*$/, ''); return t.length > 36 ? `${t.slice(0, 35)}…` : t; } }
        : { show: false },
      labelLayout: { hideOverlap: true },
      emphasis: { scale: 1.4, label: { show: true } },
    };

    const unit = weekly ? 'week' : 'month';
    const bars = weekly ? weeklyBars(points) : monthlyBars(points);
    const barMax = Math.max(2, Math.ceil(bars.max * 2.4));
    const bar = (name: string, data: (number | null)[], color: string) => ({
      name, type: 'bar' as const, yAxisIndex: 1, data, z: 1, barMaxWidth: 14, barGap: '8%',
      itemStyle: { color, opacity: 0.55, borderRadius: [3, 3, 0, 0] },
      emphasis: { itemStyle: { opacity: 0.9 } },
    });

    // the schedule lines share the dates of the plan points; a line is drawn only when every date lines up
    const aligned = !!schedule && schedule.length === points.length && schedule.every((s, i) => s.date === points[i].date);
    const scheduleLine = (name: string, key: 'baseline' | 'working', color: string) => ({
      name, type: 'line' as const, showSymbol: false, smooth: false, z: 2, data: schedule!.map(s => s[key]),
      lineStyle: { color, width: 1.8, type: [6, 4] as number[] }, itemStyle: { color },
    });
    const scheduleSeries = aligned ? [scheduleLine('Baseline schedule', 'baseline', theme.seriesColor('neutral')), scheduleLine('Working schedule', 'working', theme.seriesColor('high'))] : [];

    const nearby = (idx: number) => marks.filter(k => Math.abs(k.value[0] - idx) <= 0.55).map(k => k.m);

    chart.setOption({
      animation: false,
      grid: { left: 44, right: 40, top: expanded ? 52 : 44, bottom: ZOOM_BOTTOM },
      dataZoom: timeZoom(theme),
      legend: { top: 0, right: 0, textStyle: { color: muted, fontSize: fs }, itemWidth: 14, itemHeight: 6, data: ['Plan', 'Forecast', 'Actual', `Plan / ${unit}`, `Actual / ${unit}`, ...(aligned ? ['Baseline schedule', 'Working schedule'] : []), ...(marks.length ? ['Major milestones'] : [])] },
      tooltip: {
        ...theme.tooltip, trigger: 'axis', confine: true,
        formatter: (params: { axisValueLabel: string; dataIndex: number; seriesName: string; seriesType: string; marker: string; value: unknown }[] | { axisValueLabel: string; dataIndex: number; seriesName: string; seriesType: string; marker: string; value: unknown }) => {
          const list = Array.isArray(params) ? params : [params];
          const lines = list.filter(p => p.seriesType === 'line' || p.seriesType === 'bar').map(p => `${p.marker} ${p.seriesName}<span style="float:right;margin-left:14px;font-weight:600">${typeof p.value === 'number' ? `${p.seriesType === 'bar' ? '+' : ''}${p.value.toFixed(1)}%` : '—'}</span>`);
          const ms = nearby(list[0]?.dataIndex ?? -1);
          const extra = ms.map(m => `<div style="margin-top:4px;max-width:15rem;white-space:normal"><span style="color:${tone(m)}">◆</span> <b>${escape(m.description)}</b><br><span style="opacity:.75">${escape(m.facility ?? m.subName ?? m.id)} · ${fmtDate(milestoneDate(m))}${m.actual ? ' · done' : m.status === 'Overdue' ? ' · overdue' : ''}</span></div>`).join('');
          return `<div>${list[0]?.axisValueLabel ?? ''}</div>${lines.join('<br>')}${extra}`;
        },
      },
      xAxis: { type: 'category', data: points.map(p => (weekly ? dayLabel(p.date) : monthLabel(p.date))), axisLabel: { color: muted, fontSize: fs, interval: 'auto', hideOverlap: true }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', min: 0, max: 100, axisLabel: { color: muted, fontSize: fs, formatter: '{value}%' }, splitLine: { lineStyle: { color: line, type: 'dashed' } } },
        { type: 'value', min: 0, max: barMax, position: 'right', axisLabel: { color: muted, fontSize: fs - 1, formatter: '{value}%' }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
      ],
      series: [bar(`Plan / ${unit}`, bars.plan, theme.plan), bar(`Actual / ${unit}`, bars.actual, theme.teal), series('Plan', 'plan', theme.plan), ...scheduleSeries, forecast, actual, ...(marks.length ? [milestoneSeries] : [])],
    }, true);
  }, [chart, points, milestones, cutoff, expanded, dark, schedule]);

  const doneCount = milestones.filter(m => m.actual).length;
  const label = `EPCIC S-curve, plan versus forecast and actual, with ${isWeekly(points) ? 'weekly' : 'monthly'} progress bars${cutoff ? `, cut-off ${fmtDate(cutoff)}` : ''}${milestones.length ? `, with ${milestones.length} major milestones, ${doneCount} achieved` : ''}`;
  return <div className={`chart ${expanded ? 'chart-expanded' : ''}`}><div ref={el} role="img" aria-label={label} style={{ minHeight: expanded ? 460 : 300 }} /></div>;
}
