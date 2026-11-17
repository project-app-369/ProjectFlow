import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActualPlanBar } from './ui';

describe('actual versus plan progress', () => {
  it('renders the reference values, actual fill and independent plan marker', () => {
    const html = renderToStaticMarkup(<ActualPlanBar actual={47.6} plan={50} />);
    expect(html).toContain('47.6% actual, 50.0% plan, -2.4%');
    expect(html).toContain('apbar-fill behind');
    expect(html).toContain('width:47.6%');
    expect(html).toContain('left:50%');
  });
  it('keeps missing measurements distinct from zero and omits their comparison', () => {
    const html = renderToStaticMarkup(<ActualPlanBar actual={null} plan={50} />);
    expect(html).toContain('Actual unavailable');
    expect(html).not.toContain('apbar-fill');
    expect(html).not.toContain(' pp');
    expect(renderToStaticMarkup(<ActualPlanBar actual={0} plan={null} />)).toContain('0.0% actual, plan unavailable');
  });
  it('clamps only geometry and treats invalid input as unavailable', () => {
    const html = renderToStaticMarkup(<ActualPlanBar actual={120} plan={100} />);
    expect(html).toContain('120.0% actual');
    expect(html).toContain('width:100%');
    expect(renderToStaticMarkup(<ActualPlanBar actual={NaN} plan={Infinity} />)).not.toContain('apbar-plan');
  });
});
