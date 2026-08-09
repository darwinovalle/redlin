import { useEffect, useRef, useState } from 'react';
import { srService } from '../services/api/sr';

const MIN_SECONDS = 3;

// Commits the time elapsed since the last commit (a delta), then advances the
// boundary. Deltas (not cumulative totals) mean a second is reported at most
// once, so the backend can award XP without double-counting even when both a
// hide-event and an unmount commit fire for the same session.
function commitTime(lastCommitRef, payload) {
  const now = Date.now();
  const seconds = Math.round((now - lastCommitRef.current) / 1000);
  lastCommitRef.current = now;
  if (seconds >= MIN_SECONDS) {
    srService.recordStudy(payload(seconds)).catch(() => {});
  }
}

// Overall study-page timer: silently records total time on leave/hide AND
// returns the live elapsed seconds so the page can display a visible counter.
export function useStudySession({ model, itemId, topic } = {}) {
  const startRef = useRef(Date.now()); // drives the visible counter
  const commitRef = useRef(Date.now()); // last-committed delta boundary
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    commitRef.current = Date.now();
    setElapsed(0);
    const tick = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    const onVisibility = () => { if (document.hidden) commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, topic })); };
    const onPageHide = () => commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, topic }));
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, topic }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, itemId, topic]);

  return elapsed;
}

// Per-section timer: silently records study time for one activity (MCQ / CLOZE
// / FEYNMAN) on a source, attributed with that method for the per-source split.
export function useStudySection({ model, itemId, method, topic } = {}) {
  const commitRef = useRef(Date.now());

  useEffect(() => {
    commitRef.current = Date.now();
    const onVisibility = () => { if (document.hidden) commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic })); };
    const onPageHide = () => commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic }));
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      commitTime(commitRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic }));
    };
  }, [model, itemId, method, topic]);
}

export default useStudySession;
