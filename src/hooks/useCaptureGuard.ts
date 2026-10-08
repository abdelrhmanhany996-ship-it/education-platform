import { useEffect, useRef, useState } from 'react';

export type CaptureAttempt = 'screenshot_key' | 'left_window' | 'print';

/**
 * Hides protected content whenever it may be captured:
 *  - the window loses focus (screen recorders, snipping tools and other apps take focus) or the tab is hidden
 *  - a screenshot shortcut is pressed (Print Screen, Win+Shift+S, Cmd+Shift+3/4/5)
 *  - the page is printed
 * A web page cannot block screen capture outright; this keeps casual captures blank and reports the attempt.
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
    const lastReport: Partial<Record<CaptureAttempt, number>> = {};
    const attempt = (kind: CaptureAttempt) => {
      setConcealed(true);
      // One report per burst of events of the same kind
      if (Date.now() - (lastReport[kind] || 0) > 10_000) {
        lastReport[kind] = Date.now();
        report.current?.(kind);
      }
    };
    const onBlur = () => attempt('left_window');
    const onFocus = () => setConcealed(false);
    const onVisibility = () => (document.hidden ? attempt('left_window') : document.hasFocus() && setConcealed(false));
    const onKey = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase();
      const printScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen';
      const winSnip = e.shiftKey && e.metaKey && k === 's';
      const macShot = e.shiftKey && e.metaKey && ['3', '4', '5', '6'].includes(k);
      if (!printScreen && !winSnip && !macShot) return;
      attempt('screenshot_key');
      // Print Screen copies to the clipboard: replace it
      navigator.clipboard?.writeText('').catch(() => undefined);
      window.setTimeout(() => document.hasFocus() && !document.hidden && setConcealed(false), 2_000);
    };
    // Pages meant to be printed (the certificate) mark their paper with data-printable
    const onPrint = () => !document.querySelector('[data-printable]') && attempt('print');
    window.addEventListener('beforeprint', onPrint);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    if (!document.hasFocus()) setConcealed(true);
    return () => {
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [active]);

  return concealed;
}
