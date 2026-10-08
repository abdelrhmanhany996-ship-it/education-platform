import { RefObject, useCallback, useEffect, useState } from 'react';

type IOSVideo = HTMLVideoElement & { webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };

/**
 * Fullscreen that always includes the watermark: the box holding the video and its overlays goes fullscreen,
 * never the bare <video>. Native video fullscreen (double-click, iPhone's player button) is caught and swapped
 * for the box. Where the page cannot go fullscreen (iPhone Safari) the box fills the screen with CSS instead.
 */
export function useProtectedFullscreen(boxRef: RefObject<HTMLElement | null>) {
  const [real, setReal] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  const canReal = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  const enter = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    if (canReal && box.requestFullscreen) box.requestFullscreen().catch(() => setPseudo(true));
    else setPseudo(true);
  }, [boxRef, canReal]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setPseudo(false);
  }, []);

  const toggle = useCallback(() => (real || pseudo ? exit() : enter()), [real, pseudo, enter, exit]);

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement;
      const box = boxRef.current;
      setReal(!!box && el === box);
      // The bare video went fullscreen (double-click, keyboard): put the watermarked box there instead
      if (box && el && el !== box && box.contains(el)) {
        document
          .exitFullscreen()
          .then(() => box.requestFullscreen())
          .catch(() => setPseudo(true));
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [boxRef]);

  // iPhone: the player's own fullscreen shows only the video; leave it at once and fill the screen with the box
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onBegin = (e: Event) => {
      const v = e.target as IOSVideo;
      v.webkitExitFullscreen?.();
      setPseudo(true);
    };
    box.addEventListener('webkitbeginfullscreen', onBegin, true);
    return () => box.removeEventListener('webkitbeginfullscreen', onBegin, true);
  }, [boxRef]);

  useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPseudo(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [pseudo]);

  return { isFullscreen: real || pseudo, pseudo, toggle };
}
