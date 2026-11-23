import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * The open detail item of a page lives in the address as `?id=<item id>` (`?id=new` for a blank form), so every
 * risk, issue, task, interface point… has its own link that opens its detail on load. Other query parameters
 * (filters, views) are kept. Opening adds a history entry, so Back closes the detail; closing replaces it.
 */
export function useDeepLink(): [string | null, (id: string | null) => void] {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = params.get('id');
  const set = useCallback((next: string | null) => {
    const p = new URLSearchParams(location.search); // the router's own query: with hash routes (static build) window.location.search is empty
    if (next) p.set('id', next); else p.delete('id');
    const search = p.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: !next });
  }, [navigate, location.pathname, location.search]);
  return [id, set];
}

/** The same, for pages whose detail needs the whole row: the row is found by id in the rows the page has loaded. */
export function useDeepLinkItem<T>(items: T[], getId: (t: T) => string): [T | 'new' | null, (v: T | 'new' | null) => void] {
  const [id, setId] = useDeepLink();
  const item = id === 'new' ? 'new' : id ? items.find(t => getId(t) === id) ?? null : null;
  const set = useCallback((v: T | 'new' | null) => setId(v === null ? null : v === 'new' ? 'new' : getId(v)), [setId, getId]);
  return [item, set];
}
