import { useCallback, useEffect, useRef, useState } from 'react';

export type CaptureAttempt = 'screenshot_key' | 'recording_key' | 'print';

/** How long the content stays hidden after a screenshot shortcut. */
const HIDE_MS = 3_000;
const RESUME_EVENT = 'capture-guard:resume';

/**
 * Hides protected content when a capture is attempted and reports it:
 *  - a screenshot shortcut is pressed (Print Screen, Win+Shift+S, Cmd+Shift+3/4)
 *  - a screen-recording shortcut is pressed (Xbox Game Bar Win+Alt+R / Win+G, Snipping Tool Win+Shift+R,
 *    macOS Cmd+Shift+5, NVIDIA Alt+F9/F10): hidden until the student chooses to continue
 *  - the page is printed
 * Switching windows or tabs does not hide anything. A web page cannot see phone screenshots or background
 * screen recorders; the name/ID watermark on videos is what identifies those copies.
 */
export function useCaptureGuard(active: boolean, onAttempt?: (kind: CaptureAttempt) => void) {
  const [concealed, setConcealed] = useState<false | 'capture' | 'recording'>(false);
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
      setConcealed(c => (kind === 'recording_key' ? 'recording' : c || 'capture'));
      // One report per burst of events of the same kind
      if (Date.now() - (lastReport[kind] || 0) > 10_000) {
        lastReport[kind] = Date.now();
        report.current?.(kind);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Physical keys (e.code), so an Arabic keyboard layout is detected too
      const code = e.code;
      const printScreen = e.key === 'PrintScreen' || code === 'PrintScreen';
      const winSnip = e.shiftKey && e.metaKey && code === 'KeyS';
      const macShot = e.shiftKey && e.metaKey && (code === 'Digit3' || code === 'Digit4' || code === 'Digit6');
      const recording =
        (e.metaKey && e.altKey && code === 'KeyR') || // Xbox Game Bar: record
        (e.metaKey && e.shiftKey && code === 'KeyR') || // Windows 11 Snipping Tool: record
        (e.metaKey && !e.shiftKey && !e.altKey && code === 'KeyG') || // Xbox Game Bar
        (e.metaKey && e.shiftKey && code === 'Digit5') || // macOS screenshot / recording toolbar
        (e.altKey && (code === 'F9' || code === 'F10')); // NVIDIA ShadowPlay
      if (recording) {
        window.clearTimeout(timer);
        attempt('recording_key');
        return;
      }
      if (!printScreen && !winSnip && !macShot) return;
      attempt('screenshot_key');
      // Print Screen copies to the clipboard: replace it
      navigator.clipboard?.writeText('').catch(() => undefined);
      window.clearTimeout(timer);
      // A screenshot is instant; a recording keeps the content hidden until the student continues
      timer = window.setTimeout(() => setConcealed(c => (c === 'recording' ? c : false)), HIDE_MS);
    };
    // Pages meant to be printed (the certificate) mark their paper with data-printable
    const onPrint = () => !document.querySelector('[data-printable]') && attempt('print');
    const afterPrint = () => setConcealed(c => (c === 'recording' ? c : false));
    const onResume = () => setConcealed(false);
    window.addEventListener(RESUME_EVENT, onResume);
    window.addEventListener('beforeprint', onPrint);
    window.addEventListener('afterprint', afterPrint);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(RESUME_EVENT, onResume);
      window.removeEventListener('beforeprint', onPrint);
      window.removeEventListener('afterprint', afterPrint);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
    };
  }, [active]);

  /** The student closes the notice after a recording shortcut (there is no way to know when recording stops). */
  // Every guard on the page (app-wide and the lecture viewer) shows its content again
  const resume = useCallback(() => window.dispatchEvent(new Event(RESUME_EVENT)), []);
  return { concealed: !!concealed, recording: concealed === 'recording', resume };
}
