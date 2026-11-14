/**
 * On phones the registers show one card per row (see the max-width:720px block in styles.css).
 * A card needs each cell to carry its column name, so this copies every header's text onto the cells below it.
 * It watches the page for new rows, so it covers any table without each page doing anything.
 */
const PHONE = '(max-width: 720px)';

const clean = (t: string | null) => (t ?? '').replace(/[↑↓]/g, '').replace(/\s+/g, ' ').trim();

function label(table: HTMLTableElement) {
  const heads = table.tHead?.rows.length ? [...table.tHead.rows[table.tHead.rows.length - 1].cells].map(h => clean(h.textContent)) : [];
  if (!heads.length) return;
  for (const body of table.tBodies) {
    for (const row of body.rows) {
      let col = 0;
      for (const cell of row.cells) {
        if (cell.colSpan > 1) { col += cell.colSpan; continue; }
        const name = heads[col] ?? '';
        if (cell.dataset.label !== name) cell.dataset.label = name;
        col += 1;
      }
    }
  }
}

export function startMobileTables(root: HTMLElement): () => void {
  const mq = window.matchMedia(PHONE);
  let queued = 0;
  const run = () => { queued = 0; if (mq.matches) root.querySelectorAll('table').forEach(t => label(t as HTMLTableElement)); };
  const schedule = () => { if (!queued) queued = requestAnimationFrame(run); };
  const observer = new MutationObserver(schedule); // child changes only, so setting attributes cannot loop
  observer.observe(root, { childList: true, subtree: true });
  mq.addEventListener('change', schedule);
  schedule();
  return () => { observer.disconnect(); mq.removeEventListener('change', schedule); if (queued) cancelAnimationFrame(queued); };
}
