import { useState, useSyncExternalStore } from 'react';
import { Icon } from './icons';
import { Btn, Modal } from './ui';

/**
 * Installing Project Flow as an app. Chrome, Edge and Android offer an install prompt that the page can trigger from its
 * own button; Safari on iPhone and iPad has none, so there the button explains Share → Add to Home Screen.
 */
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPrompt | null = null;
let installed = typeof window !== 'undefined' && isStandalone();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPrompt; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit(); });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => { installed = isStandalone(); emit(); });
}

/** Registers the service worker that lets the app open without a connection. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the app works without it */ }); });
}

export type InstallState = 'installed' | 'ready' | 'ios' | 'unavailable';

export function useInstall() {
  const state = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    (): InstallState => (installed ? 'installed' : deferred ? 'ready' : isIos() ? 'ios' : 'unavailable'),
    () => 'unavailable' as InstallState,
  );
  const install = async () => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null;
    emit();
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { installed = true; emit(); }
  };
  return { state, install };
}

function IosSteps({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Install Project Flow" size="sm" onClose={onClose} actions={<Btn kind="primary" iconOnly={false} onClick={onClose}>Got it</Btn>}>
      <div className="dialog-body">
        <ol className="install-steps">
          <li>Open this page in <strong>Safari</strong>.</li>
          <li>Tap the <strong>Share</strong> button.</li>
          <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
        </ol>
        <p className="tiny muted">Project Flow then opens full screen from its own icon.</p>
      </div>
    </Modal>
  );
}

/** The install button: an icon in the header, or a labelled button elsewhere. Hidden when installing is not possible or already done. */
export function InstallButton({ labelled = false }: { labelled?: boolean }) {
  const { state, install } = useInstall();
  const [steps, setSteps] = useState(false);
  if (state === 'installed' || state === 'unavailable') return null;
  const go = () => (state === 'ready' ? install() : setSteps(true));
  return (
    <>
      {labelled
        ? <Btn kind="small primary" icon="down" iconOnly={false} onClick={go}>Install app</Btn>
        : <button type="button" className="icon-btn round install-btn" aria-label="Install Project Flow as an app" title="Install Project Flow as an app" onClick={go}><Icon name="down" /></button>}
      {steps && <IosSteps onClose={() => setSteps(false)} />}
    </>
  );
}
