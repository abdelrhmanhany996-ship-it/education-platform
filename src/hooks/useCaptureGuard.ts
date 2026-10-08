import { useEffect, useRef, useState } from 'react';

export type CaptureAttempt = 'screenshot_key' | 'print';

/** How long the content stays hidden after a screenshot shortcut. */
const HIDE_MS = 3_000;

/**
 * Hides protected content when a capture is attempted and reports it:
 *  - a screenshot shortcut is pressed (Print Screen, Win+Shift+S, Cmd+Shift+3/4/5)
 *  - the page is printed
 * Switching windows or tabs does not hide anything. A web page cannot see phone screenshots or background
 * screen recorders; the name/ID watermark on videos is what identifies those copies.
 */
export function useCaptureGuard(active: boolean, onAttempt?: (kind: CaptureAttempt) => void) {
  const [concealed, setConcealed] = useState(false);
  const report = useRef(onAttempt);
  report.current = onAttempt;

  useEffect(() => {
    if (!active) {
      setConcealed(false);
      return;
    }
    let timer = 0;
    const lastReport: Partial<Record<CaptureAttempt, number>> = {};
    const attempt = (kind: CaptureAttempt) => {
      setConcealed(true);
      // One report per burst of events of the same kind
      if (Date.now() - (lastReport[kind] || 0) > 10_000) {
        lastReport[kind] = Date.now();
        report.current?.(kind);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase();
      const printScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen';
      const winSnip = e.shiftKey && e.metaKey && k === 's';
      const macShot = e.shiftKey && e.metaKey && ['3', '4', '5', '6'].includes(k);
      if (!printScreen && !winSnip && !macShot) return;
      attempt('screenshot_key');
      // Print Screen copies to the clipboard: replace it
      navigator.clipboard?.writeText('').catch(() => undefined);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setConcealed(false), HIDE_MS);
    };
    // Pages meant to be printed (the certificate) mark their paper with data-printable
    const onPrint = () => !document.querySelector('[data-printable]') && attempt('print');
    const afterPrint = () => setConcealed(false);
    window.addEventListener('beforeprint', onPrint);
    window.addEventListener('afterprint', afterPrint);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('afterprint', afterPrint);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [active]);

  return concealed;
}
