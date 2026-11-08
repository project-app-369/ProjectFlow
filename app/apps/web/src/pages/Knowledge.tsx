import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorText, qs, request, type KnowledgeArticle, type KnowledgeDomain, type KnowledgeInput, type KnowledgePage, type KnowledgeSource, type KnowledgeSummary, type KnowledgeTaxonomy } from '../api';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useAccess, useApp, useToast } from '../state';
import { Badge, Btn, Confirm, ErrorBox, Field, Loading, Modal, PageHead, Pager, useDebounced } from '../ui';
import { ArticleBody } from './knowledgeBody';

const PAGE_SIZE = 24;

function useKnowledgeSummary() {
  const { project } = useApp();
  return useQuery({ queryKey: ['knowledge-summary', project.id], queryFn: () => request<KnowledgeSummary>(`/projects/${project.id}/knowledge/summary`) });
}

/** General Knowledge: the Overview (every area) or one area, as a list of short articles with a reader and an editor. */
export default function Knowledge({ domain }: { domain?: KnowledgeDomain }) {
  const { project } = useApp();
  const access = useAccess();
  const summary = useKnowledgeSummary();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<KnowledgeArticle | 'new' | null>(null);
  const debounced = useDebounced(q);
  const base = `/projects/${project.id}/knowledge`;
  const searching = !!debounced.trim() || !!category || !!status;
  const showList = !!domain || searching;

  const query = qs({ domain, category, status, q: debounced.trim(), page, pageSize: PAGE_SIZE });
  const list = useQuery({ queryKey: ['knowledge', project.id, query], queryFn: () => request<KnowledgePage>(`${base}${query}`), enabled: showList, placeholderData: keepPreviousData });

  const area = summary.data?.taxonomy.find(t => t.domain === domain);
  const counts = domain ? summary.data?.byDomain[domain] : undefined;
  const reset = (patch: { q?: string; category?: string; status?: string }) => {
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.category !== undefined) setCategory(patch.category);
    if (patch.status !== undefined) setStatus(patch.status);
    setPage(1);
  };

  return (
    <>
      <PageHead title={area?.label ?? 'General Knowledge'}
        desc={domain ? `What the project documents say about ${area?.label ?? 'this area'}, in short articles that point back to their source documents.` : 'What the project documents say, organized by discipline and topic. Search everything, or open an area.'}
        actions={access.canWrite ? <Btn kind="small primary" icon="plus" onClick={() => setEditing('new')}>New article</Btn> : undefined} />

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="toolbar" style={{ paddingTop: 'var(--sp-5)' }}>
          <label className="search" style={{ flex: '1 1 20rem' }}>
            <Icon name="search" />
            <input placeholder={domain ? `Search ${area?.label ?? 'this area'}…` : 'Search all articles, topics and tags…'} value={q} onChange={e => reset({ q: e.target.value })} aria-label="Search knowledge" />
          </label>
          <div className="filter-group">
            {(domain || showList) && summary.data && (
              <select className="filter" aria-label="Filter by topic" value={category} onChange={e => reset({ category: e.target.value })}>
                <option value="">All topics</option>
                {(area?.categories ?? [...new Set(summary.data.taxonomy.flatMap(t => t.categories))]).map(c => <option key={c}>{c}</option>)}
              </select>
            )}
            <select className="filter" aria-label="Filter by status" value={status} onChange={e => reset({ status: e.target.value })}>
              <option value="">Published and drafts</option><option>Published</option><option>Draft</option>
            </select>
            {searching && <Btn kind="small" onClick={() => reset({ q: '', category: '', status: '' })}>Clear</Btn>}
          </div>
        </div>
        {domain && area && counts && (
          <div className="chip-bar" role="tablist" aria-label="Topics">
            <button role="tab" aria-selected={!category} className={`chip-filter ${!category ? 'active' : ''}`} onClick={() => reset({ category: '' })}>All <span>{counts.total}</span></button>
            {area.categories.map(c => (
              <button key={c} role="tab" aria-selected={category === c} className={`chip-filter ${category === c ? 'active' : ''}`} onClick={() => reset({ category: c })}>{c} <span>{counts.byCategory[c] ?? 0}</span></button>
            ))}
          </div>
        )}
      </div>

      {summary.error ? <ErrorBox error={summary.error} /> : null}

      {!showList ? (
        <Overview summary={summary.data} canWrite={access.canWrite} onOpen={setOpenId} onNew={() => setEditing('new')} />
      ) : list.error ? <ErrorBox error={list.error} /> : !list.data ? <Loading /> : (
        <>
          {list.data.items.length ? (
            <div className="article-grid">
              {list.data.items.map(a => <ArticleCard key={a.id} a={a} showDomain={!domain} onOpen={() => setOpenId(a.id)} />)}
            </div>
          ) : (
            <div className="panel empty">
              {searching ? 'No article matches. Change the search or filters.' : `No articles in ${area?.label ?? 'this area'} yet.`}
              {!searching && access.canWrite && <div style={{ marginTop: 12 }}><Btn kind="small primary" onClick={() => setEditing('new')}>Write the first article</Btn></div>}
            </div>
          )}
          {list.data.total > PAGE_SIZE && <div className="panel" style={{ marginTop: 16 }}><Pager page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} /></div>}
        </>
      )}

      {openId && <Reader id={openId} base={base} onClose={() => setOpenId(null)} onEdit={a => { setOpenId(null); setEditing(a); }} />}
      {editing && summary.data && <ArticleForm article={editing === 'new' ? null : editing} taxonomy={summary.data.taxonomy} domain={domain} base={base} onClose={() => setEditing(null)} />}
    </>
  );
}

function ArticleCard({ a, showDomain, onOpen }: { a: KnowledgeArticle; showDomain: boolean; onOpen: () => void }) {
  return (
    <article className="article-card">
      <div className="article-meta tiny muted">{showDomain ? `${a.domainLabel} · ` : ''}{a.category}{a.status === 'Draft' && <> <Badge tone="amber">Draft</Badge></>}</div>
      <h3><button className="link-button" onClick={onOpen}>{a.title}</button></h3>
      <p className="clamp3">{a.summary}</p>
      <div className="chips">{a.tags.slice(0, 4).map(t => <span key={t} className="chip">{t}</span>)}</div>
      <div className="article-foot tiny muted">
        <span>{a.sources.length ? `${a.sources.length} source${a.sources.length === 1 ? '' : 's'}` : 'No sources listed'}</span>
        <span>Updated {fmtDate(a.updatedAt.slice(0, 10))}</span>
      </div>
    </article>
  );
}

function Overview({ summary, canWrite, onOpen, onNew }: { summary?: KnowledgeSummary; canWrite: boolean; onOpen: (id: string) => void; onNew: () => void }) {
  if (!summary) return <Loading />;
  const enabled = summary.taxonomy.filter(t => t.enabled);
  return (
    <>
      <div className="domain-grid">
        {enabled.map(t => {
          const d = summary.byDomain[t.domain];
          return (
            <Link key={t.domain} to={`/m/${t.moduleKey}`} className="domain-tile">
              <div className="domain-top"><Icon name="book" /><span className="domain-count mono">{d?.total ?? 0}</span></div>
              <h3>{t.label}</h3>
              <p className="tiny muted">{t.categories.filter(c => c !== 'Other').slice(0, 6).join(' · ')}{t.categories.length > 7 ? ' …' : ''}</p>
            </Link>
          );
        })}
        {!enabled.length && <div className="panel empty">All knowledge areas are switched off. <Link className="btn small" to="/settings/modules">Open module settings</Link></div>}
      </div>
      <div className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head"><div><h2>Recently updated</h2><p>{summary.total} articles{summary.drafts ? ` · ${summary.drafts} draft${summary.drafts === 1 ? '' : 's'}` : ''}</p></div></div>
        {summary.recent.length ? summary.recent.map(a => (
          <div className="list-card" key={a.id}>
            <Icon name="doc" />
            <div className="grow"><p><button className="link-button" onClick={() => onOpen(a.id)}><strong>{a.title}</strong></button></p><small>{a.domainLabel} · {a.category} · {fmtDate(a.updatedAt.slice(0, 10))}</small></div>
            {a.status === 'Draft' && <Badge tone="amber">Draft</Badge>}
          </div>
        )) : <div className="empty">No articles yet.{canWrite && <div style={{ marginTop: 12 }}><Btn kind="small primary" onClick={onNew}>Write the first article</Btn></div>}</div>}
      </div>
    </>
  );
}

function Reader({ id, base, onClose, onEdit }: { id: string; base: string; onClose: () => void; onEdit: (a: KnowledgeArticle) => void }) {
  const access = useAccess();
  const toast = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const q = useQuery({ queryKey: ['knowledge-article', base, id], queryFn: () => request<KnowledgeArticle>(`${base}/${id}`) });
  const remove = useMutation({
    mutationFn: () => request<void>(`${base}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); qc.invalidateQueries({ queryKey: ['knowledge-summary'] }); toast('Article deleted.'); onClose(); },
    onError: (e: Error) => { setConfirming(false); toast(errorText(e)); },
  });
  const a = q.data;
  return (
    <>
      <Modal title={a ? a.title : 'Article'} onClose={onClose}
        actions={<>
          {a && access.canManage && <Btn kind="text" onClick={() => setConfirming(true)}>Delete</Btn>}
          {a && access.canWrite && <Btn onClick={() => onEdit(a)}>Edit</Btn>}
          <Btn onClick={onClose}>Close</Btn>
        </>}>
        <div className="dialog-body">
          {q.error ? <ErrorBox error={q.error} /> : !a ? <Loading /> : (
            <>
              <div className="eyebrow">{a.domainLabel} · {a.category}</div>
              <p className="lead">{a.summary}</p>
              <div className="tiny muted" style={{ margin: '4px 0 14px' }}>
                {a.status === 'Draft' && <><Badge tone="amber">Draft</Badge> </>}Updated {fmtDate(a.updatedAt.slice(0, 10))} by {a.updatedBy}
              </div>
              <ArticleBody text={a.body ?? ''} />
              {a.tags.length > 0 && <div className="chips" style={{ marginTop: 16 }}>{a.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>}
              <h3 style={{ marginTop: 22 }}>Source documents</h3>
              {a.sources.length ? (
                <ul className="source-list">
                  {a.sources.map((s, i) => (
                    <li key={i}>
                      <Icon name="doc" />
                      <span>{s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}{s.ref && <small className="muted"> · {s.ref}</small>}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="tiny muted">No source documents are listed for this article.</p>}
            </>
          )}
        </div>
      </Modal>
      {confirming && a && (
        <Confirm title={`Delete “${a.title}”?`} busy={remove.isPending} onConfirm={() => remove.mutate()} onClose={() => setConfirming(false)}><p>The article will be removed. This cannot be undone.</p></Confirm>
      )}
    </>
  );
}

function ArticleForm({ article, taxonomy, domain, base, onClose }: { article: KnowledgeArticle | null; taxonomy: KnowledgeTaxonomy[]; domain?: KnowledgeDomain; base: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const open = taxonomy.filter(t => t.enabled);
  const firstDomain = (article?.domain ?? domain ?? open[0]?.domain ?? 'engineering') as KnowledgeDomain;
  const [v, setV] = useState({
    domain: firstDomain, category: article?.category ?? taxonomy.find(t => t.domain === firstDomain)?.categories[0] ?? '',
    title: article?.title ?? '', summary: article?.summary ?? '', body: '', tags: article?.tags.join(', ') ?? '', status: (article?.status ?? 'Published') as 'Draft' | 'Published',
    sources: (article?.sources ?? []) as KnowledgeSource[],
  });
  const [error, setError] = useState('');
  // the list view does not carry the text, so an edit loads it first
  const full = useQuery({ queryKey: ['knowledge-article', base, article?.id], queryFn: () => request<KnowledgeArticle>(`${base}/${article!.id}`), enabled: !!article });
  const [bodyLoaded, setBodyLoaded] = useState(!article);
  if (article && full.data && !bodyLoaded) { setBodyLoaded(true); setV(s => ({ ...s, body: full.data.body ?? '' })); }

  const up = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV(s => ({ ...s, [k]: val }));
  const cats = taxonomy.find(t => t.domain === v.domain)?.categories ?? [];
  const setSource = (i: number, patch: Partial<KnowledgeSource>) => up('sources', v.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = useMutation({
    mutationFn: () => {
      const body: KnowledgeInput = {
        domain: v.domain, category: v.category, title: v.title, summary: v.summary, body: v.body, status: v.status,
        tags: v.tags.split(',').map(t => t.trim()).filter(Boolean),
        sources: v.sources.filter(s => s.title.trim()).map(s => ({ title: s.title.trim(), ref: s.ref?.trim() || null, url: s.url?.trim() || null })),
      };
      return article ? request<KnowledgeArticle>(`${base}/${article.id}`, { method: 'PATCH', body: JSON.stringify(body) }) : request<KnowledgeArticle>(base, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['knowledge'] }); qc.invalidateQueries({ queryKey: ['knowledge-summary'] }); qc.invalidateQueries({ queryKey: ['knowledge-article'] });
      toast(article ? 'Article updated.' : 'Article saved.'); onClose();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal title={article ? `${article.id} · Edit article` : 'New article'} onClose={onClose}
      actions={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={save.isPending || !v.title.trim() || !v.summary.trim() || (!!article && !bodyLoaded)} onClick={() => { setError(''); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save'}</Btn></>}>
      <div className="dialog-body">
        <div className="form-grid">
          <Field label="Area"><select value={v.domain} onChange={e => { const d = e.target.value as KnowledgeDomain; setV(s => ({ ...s, domain: d, category: taxonomy.find(t => t.domain === d)?.categories[0] ?? '' })); }}>
            {(article ? taxonomy : open).map(t => <option key={t.domain} value={t.domain} disabled={!t.enabled}>{t.label}</option>)}
          </select></Field>
          <Field label="Topic"><select value={v.category} onChange={e => up('category', e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Title" full><input value={v.title} maxLength={160} onChange={e => up('title', e.target.value)} autoFocus /></Field>
          <Field label="Summary" full hint="One or two sentences shown on the card"><textarea value={v.summary} maxLength={500} rows={2} onChange={e => up('summary', e.target.value)} /></Field>
          <Field label="Article" full hint="## Heading · - bullet · 1. numbered · **bold** · paste a link to make it clickable"><textarea value={v.body} rows={10} maxLength={30000} onChange={e => up('body', e.target.value)} disabled={!!article && !bodyLoaded} /></Field>
          <Field label="Tags" hint="Separated by commas"><input value={v.tags} onChange={e => up('tags', e.target.value)} /></Field>
          <Field label="Status" hint="Drafts are visible to the team and marked as drafts"><select value={v.status} onChange={e => up('status', e.target.value as 'Draft' | 'Published')}><option>Published</option><option>Draft</option></select></Field>
          <div className="field full">
            Source documents <span className="tiny muted">The documents this article summarizes</span>
            <div className="subtask-edit">
              {v.sources.map((s, i) => (
                <div className="source-row" key={i}>
                  <input value={s.title} placeholder="Document title" aria-label={`Source ${i + 1} title`} maxLength={200} onChange={e => setSource(i, { title: e.target.value })} />
                  <input value={s.ref ?? ''} placeholder="Doc no. / revision" aria-label={`Source ${i + 1} reference`} maxLength={80} onChange={e => setSource(i, { ref: e.target.value })} />
                  <input value={s.url ?? ''} placeholder="Link (https://…)" aria-label={`Source ${i + 1} link`} maxLength={500} onChange={e => setSource(i, { url: e.target.value })} />
                  <button type="button" className="icon-btn" aria-label={`Remove source ${i + 1}`} onClick={() => up('sources', v.sources.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <div><Btn kind="small" onClick={() => up('sources', [...v.sources, { title: '', ref: null, url: null }])}>Add a source document</Btn></div>
            </div>
          </div>
        </div>
        {error && <p className="negative" role="alert" style={{ marginTop: 14 }}>{error}</p>}
      </div>
    </Modal>
  );
}
