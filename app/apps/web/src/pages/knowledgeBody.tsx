import type { ReactNode } from 'react';

export type Block =
  | { kind: 'h'; level: 2 | 3; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string };

/** Turns the plain text an author types into blocks: ## and ### headings, "- " bullets, "1. " numbered items, paragraphs. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) flush();
    else if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { flush(); blocks.push({ kind: 'h', level: m[1].length as 2 | 3, text: m[2] }); }
    else if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(m[1]); else blocks.push({ kind: 'ul', items: [m[1]] });
    } else if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ol') last.items.push(m[1]); else blocks.push({ kind: 'ol', items: [m[1]] });
    } else para.push(line);
  }
  flush();
  return blocks;
}

/** **bold** and bare http(s) links inside a line. Everything else is plain text, so nothing typed can inject markup. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|(https?:\/\/[^\s<>"')]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] ? <strong key={i++}>{m[1]}</strong> : <a key={i++} href={m[2]} target="_blank" rel="noreferrer noopener">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ArticleBody({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  if (!blocks.length) return <p className="muted">This article has no text yet.</p>;
  return (
    <div className="article-body">
      {blocks.map((b, i) => b.kind === 'h'
        ? (b.level === 2 ? <h3 key={i}>{inline(b.text)}</h3> : <h4 key={i}>{inline(b.text)}</h4>)
        : b.kind === 'ul' ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
        : b.kind === 'ol' ? <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
        : <p key={i}>{inline(b.text)}</p>)}
    </div>
  );
}
