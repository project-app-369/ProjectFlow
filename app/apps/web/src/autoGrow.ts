/**
 * Text areas grow to fit their content (CSS `field-sizing: content`). Browsers without it (Firefox) get the same
 * from one delegated listener, which also sizes text areas that are already filled when they appear.
 */
export function startAutoGrow(): () => void {
  if (typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content')) return () => {};
  const fit = (t: HTMLTextAreaElement) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + (t.offsetHeight - t.clientHeight)}px`; };
  const onInput = (e: Event) => { if (e.target instanceof HTMLTextAreaElement) fit(e.target); };
  const sweep = () => document.querySelectorAll('textarea').forEach(t => { if (!t.dataset.grown || t.dataset.grown !== String(t.value.length)) { t.dataset.grown = String(t.value.length); fit(t); } });
  let queued = 0;
  const observer = new MutationObserver(() => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; sweep(); }); });
  document.addEventListener('input', onInput);
  observer.observe(document.body, { childList: true, subtree: true });
  sweep();
  return () => { document.removeEventListener('input', onInput); observer.disconnect(); if (queued) cancelAnimationFrame(queued); };
}
