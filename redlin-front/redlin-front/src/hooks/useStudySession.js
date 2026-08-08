import { useEffect, useRef, useState } from 'react';
import { srService } from '../services/api/sr';

const MIN_SECONDS = 3;

function commitTime(startAt, payload) {
  const seconds = Math.round((Date.now() - startAt.current) / 1000);
  if (seconds >= MIN_SECONDS) {
    srService.recordStudy(payload(seconds)).catch(() => {});
  }
}

// Overall study-page timer: silently records total time on leave/hide AND
// returns the live elapsed seconds so the page can display a visible counter.
export function useStudySession({ model, itemId, topic } = {}) {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const tick = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    const onVisibility = () => { if (document.hidden) commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, topic })); };
    const onPageHide = () => commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, topic }));
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, topic }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, itemId, topic]);

  return elapsed;
}

// Per-section timer: silently records study time for one activity (MCQ / CLOZE
// / FEYNMAN) on a source, attributed with that method for the per-source split.
export function useStudySection({ model, itemId, method, topic } = {}) {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const onVisibility = () => { if (document.hidden) commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic })); };
    const onPageHide = () => commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic }));
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      commitTime(startRef, (s) => ({ model, item_id: itemId, seconds: s, method, topic }));
    };
  }, [model, itemId, method, topic]);
}

export default useStudySession;