/**
 * One colour system for every chart (tokens in styles.css, "chart colour system").
 * The insights API names colours by meaning, e.g. "done" or "critical"; this resolves them to the CSS token for
 * the current theme, so light and dark stay consistent. A raw hex still works.
 */
const MEANING: Record<string, string> = {
  plan: '--c-plan', forecast: '--c-forecast', actual: '--c-actual',
  done: '--c-good', good: '--c-good', open: '--c-open', wait: '--c-warn', warn: '--c-warn', neutral: '--c-neutral', brand: '--c-brand',
  low: '--c-low', medium: '--c-medium', high: '--c-high', critical: '--c-critical', extreme: '--c-critical',
};

/** Colours an older cached response may still carry, mapped to their meaning. */
const LEGACY: Record<string, string> = {
  '#2f9d83': 'done', '#5aa985': 'done', '#3f9d6e': 'low', '#d6893a': 'open', '#c2602f': 'high', '#ec7a2f': 'high', '#d9534f': 'high',
  '#c98f2c': 'wait', '#d6a043': 'wait', '#e8c13a': 'medium', '#b23a52': 'critical', '#a3243b': 'critical', '#8e1b3a': 'critical',
  '#00877d': 'actual', '#aab2d3': 'plan', '#8d97d6': 'plan', '#4a76c9': 'brand', '#4a8fd0': 'open', '#c3c9de': 'neutral',
};

/** Read shared CSS tokens after the preference provider applies the theme. */
export function chartTheme() {
  const style = getComputedStyle(document.body);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const resolve = (color: string) => {
    const key = MEANING[color] ? color : LEGACY[color.toLowerCase()];
    return key ? token(MEANING[key]) : color;
  };
  return {
    muted: token('--muted'), line: token('--line'), teal: token('--c-actual'),
    plan: token('--c-plan'), forecast: token('--c-forecast'),
    ink: token('--ink'),
    /** For series that are categories and carry no status meaning (for example one series per discipline). */
    palette: [1, 2, 3, 4, 5, 6, 7, 8].map(n => token(`--cat-${n}`)),
    seriesColor: resolve,
    tooltip: {
      backgroundColor: token('--surface'), borderColor: token('--line'),
      textStyle: { color: token('--ink'), fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
      extraCssText: 'box-shadow:0 4px 16px #10192518;border-radius:6px;',
    },
  };
}

/**
 * A time-span slider under a chart: drag its ends to zoom in on a period, drag the bar to move along. Ctrl + wheel and pinch zoom too.
 * Charts using it leave `ZOOM_BOTTOM` pixels below the plot for the slider.
 */
export const ZOOM_BOTTOM = 62;
export function timeZoom(theme: ReturnType<typeof chartTheme>) {
  return [
    { type: 'inside' as const, zoomOnMouseWheel: 'ctrl' as const, moveOnMouseWheel: false, moveOnMouseMove: false, filterMode: 'none' as const },
    {
      type: 'slider' as const, height: 22, bottom: 8, filterMode: 'none' as const, brushSelect: false,
      borderColor: theme.line, backgroundColor: 'transparent', fillerColor: 'rgba(42,120,214,.16)', dataBackground: { lineStyle: { color: theme.line }, areaStyle: { color: theme.line, opacity: 0.35 } },
      selectedDataBackground: { lineStyle: { color: theme.plan }, areaStyle: { color: theme.plan, opacity: 0.25 } },
      handleStyle: { color: theme.plan, borderColor: theme.plan }, moveHandleStyle: { color: theme.plan, opacity: 0.4 }, textStyle: { color: theme.muted, fontSize: 11 },
    },
  ];
}
