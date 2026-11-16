import { ZOOM_BOTTOM, chartTheme, timeZoom } from './chartTheme';
import { LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';
import type { Milestone, ScurvePoint } from './api';
import { fmtDate } from './format';
import { usePrefs } from './state';

echarts.use([DataZoomComponent, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkPointComponent, LabelLayout, CanvasRenderer]);

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

const milestoneDate = (m: Milestone) => m.actual ?? m.forecast ?? m.planBaseline;

interface Props {
  points: ScurvePoint[];
  /** Major milestones of the scope, drawn on the plan curve. */
  milestones?: Milestone[];
  /** The reporting cut-off, drawn as a vertical line. */
  cutoff?: string | null;
  /** The larger copy in the dialog: milestone names are written on the chart. */
  expanded?: boolean;
}

export default function SCurveChart({ points, milestones = [], cutoff, expanded = false }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const { dark } = usePrefs();

  useEffect(() => {
    if (!el.current || !points.length) return;
    const chart = echarts.init(el.current);
    const theme = chartTheme();
    const { muted, line, ink } = theme;
    const fs = expanded ? 13 : 12;
    const series = (name: string, key: 'plan' | 'forecast' | 'actual', color: string, dashed = false, width = 2) => ({
      name, type: 'line' as const, showSymbol: false, smooth: false, connectNulls: false, z: 3,
      data: points.map(p => p[key]),
      lineStyle: { color, width, type: dashed ? ('dashed' as const) : ('solid' as const) },
      itemStyle: { color },
    });

    const weekly = points.length > 1 && day(points[1].date) - day(points[0].date) < 20;
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

    const nearby = (idx: number) => marks.filter(k => Math.abs(k.value[0] - idx) <= 0.55).map(k => k.m);

    chart.setOption({
      animation: false,
      grid: { left: 44, right: 22, top: expanded ? 52 : 44, bottom: ZOOM_BOTTOM },
      dataZoom: timeZoom(theme),
      legend: { top: 0, right: 0, textStyle: { color: muted, fontSize: fs }, itemWidth: 14, itemHeight: 6, data: ['Plan', 'Forecast', 'Actual', ...(marks.length ? ['Major milestones'] : [])] },
      tooltip: {
        ...theme.tooltip, trigger: 'axis', confine: true,
        formatter: (params: { axisValueLabel: string; dataIndex: number; seriesName: string; seriesType: string; marker: string; value: unknown }[] | { axisValueLabel: string; dataIndex: number; seriesName: string; seriesType: string; marker: string; value: unknown }) => {
          const list = Array.isArray(params) ? params : [params];
          const lines = list.filter(p => p.seriesType === 'line').map(p => `${p.marker} ${p.seriesName}<span style="float:right;margin-left:14px;font-weight:600">${typeof p.value === 'number' ? `${p.value.toFixed(1)}%` : '—'}</span>`);
          const ms = nearby(list[0]?.dataIndex ?? -1);
          const extra = ms.map(m => `<div style="margin-top:4px;max-width:15rem;white-space:normal"><span style="color:${tone(m)}">◆</span> <b>${escape(m.description)}</b><br><span style="opacity:.75">${escape(m.facility ?? m.subName ?? m.id)} · ${fmtDate(milestoneDate(m))}${m.actual ? ' · done' : m.status === 'Overdue' ? ' · overdue' : ''}</span></div>`).join('');
          return `<div>${list[0]?.axisValueLabel ?? ''}</div>${lines.join('<br>')}${extra}`;
        },
      },
      xAxis: { type: 'category', data: points.map(p => (weekly ? dayLabel(p.date) : monthLabel(p.date))), axisLabel: { color: muted, fontSize: fs, interval: 'auto', hideOverlap: true }, axisLine: { lineStyle: { color: line } }, axisTick: { show: false } },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: muted, fontSize: fs, formatter: '{value}%' }, splitLine: { lineStyle: { color: line, type: 'dashed' } } },
      series: [series('Plan', 'plan', theme.plan), forecast, actual, ...(marks.length ? [milestoneSeries] : [])],
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.dispose(); };
  }, [points, milestones, cutoff, expanded, dark]);

  const doneCount = milestones.filter(m => m.actual).length;
  const label = `EPCIC S-curve, plan versus forecast and actual${cutoff ? `, cut-off ${fmtDate(cutoff)}` : ''}${milestones.length ? `, with ${milestones.length} major milestones, ${doneCount} achieved` : ''}`;
  return <div className={`chart ${expanded ? 'chart-expanded' : ''}`}><div ref={el} role="img" aria-label={label} style={{ minHeight: expanded ? 460 : 300 }} /></div>;
}
