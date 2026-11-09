/** Compatibility with the current insights API's fixed presentation colors. */
const SERIES_TOKENS: Record<string, string> = {
  '#2f9d83': '--green', '#5aa985': '--green', '#d6893a': '--chart-orange',
  '#c2602f': '--chart-orange', '#c98f2c': '--amber', '#d6a043': '--amber',
  '#b23a52': '--red', '#00877d': '--teal', '#aab2d3': '--chart-plan',
  '#8d97d6': '--chart-plan', '#4a76c9': '--chart-blue', '#c3c9de': '--chart-neutral',
};

/** Read shared CSS tokens after the preference provider applies the theme. */
export function chartTheme() {
  const style = getComputedStyle(document.body);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    muted: token('--muted'), line: token('--line'), teal: token('--teal'),
    plan: token('--chart-plan'), forecast: token('--chart-forecast'),
    ink: token('--ink'),
    palette: ['--brand', '--teal', '--amber', '--red', '--chart-blue', '--green', '--chart-forecast', '--chart-plan'].map(token),
    seriesColor: (color: string) => SERIES_TOKENS[color.toLowerCase()] ? token(SERIES_TOKENS[color.toLowerCase()]) : color,
    tooltip: {
      backgroundColor: token('--surface'), borderColor: token('--line'),
      textStyle: { color: token('--ink'), fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
      extraCssText: 'box-shadow:0 4px 16px #10192518;border-radius:6px;',
    },
  };
}
