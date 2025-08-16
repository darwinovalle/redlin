import { useCallback, useEffect, useMemo } from 'react';

// Small reusable hook to play a short UI sound on user actions (e.g., button clicks)
// Usage:
//   import useClickSound from '../hooks/useClickSound';
//   import clickSfx from '../assets/ui-pop-sound-316482.mp3';
//   const playClick = useClickSound(clickSfx, { volume: 0.55, playbackRate: 1.0 });
//   <Button onClick={() => { playClick(); doSomething(); }} />
export default function useClickSound(src, opts = {}) {
  const { volume = 0.55, playbackRate = 1.0 } = opts;

  const audio = useMemo(() => {
    try {
      const el = new Audio(src);
      el.preload = 'auto';
      return el;
    } catch (e) {
      return null;
    }
  }, [src]);

  useEffect(() => {
    if (!audio) return;
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    return () => {
      try { audio.pause(); } catch (_) { /* noop */ }
    };
  }, [audio, volume, playbackRate]);

  const play = useCallback(() => {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      // Play must be triggered by a user gesture; buttons count as gestures in browsers
      void audio.play();
    } catch (_) {
      // ignore playback errors (e.g., policy restrictions)
    }
  }, [audio]);

  return play;
}
