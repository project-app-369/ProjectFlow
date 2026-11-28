import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadMore, withPage, type LazySource } from './lazyList';

const source = (patch: Partial<LazySource> = {}): LazySource => ({ loaded: 50, total: 214, hasMore: true, busy: false, loadingMore: false, step: 50, loadMore: () => {}, ...patch });

describe('lists that load as you scroll', () => {
  it('adds the page to a query string, empty or not', () => {
    expect(withPage('', 2, 50)).toBe('?page=2&pageSize=50');
    expect(withPage('?q=pump&sort=dueDate', 3, 25)).toBe('?q=pump&sort=dueDate&page=3&pageSize=25');
  });
  it('announces the server total and offers the next slice', () => {
    const html = renderToStaticMarkup(<LoadMore source={source()} noun="shipments" />);
    expect(html).toContain('Showing 50 of 214 shipments');
    expect(html).toContain('role="status"');
    expect(html).toContain('Load 50 more');
    expect(html).toContain('load-more has-more');
  });
  it('says when everything is shown and drops the button', () => {
    const html = renderToStaticMarkup(<LoadMore source={source({ loaded: 214, hasMore: false, step: 0 })} noun="shipments" />);
    expect(html).toContain('All 214 shipments shown');
    expect(html).not.toContain('Load ');
  });
  it('renders nothing for an empty list', () => {
    expect(renderToStaticMarkup(<LoadMore source={source({ loaded: 0, total: 0, hasMore: false })} noun="issues" />)).toBe('');
  });
});
