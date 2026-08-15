import { useEffect, useRef, useState } from 'react';
import { srService } from '../services/api/sr';

const MIN_SECONDS = 3;

function send(payloadFor, seconds) {
  if (seconds >= MIN_SECONDS) srService.recordStudy(payloadFor(seconds)).catch(() => {});
}

// Record a study-time interval ONLY while `active` is true. Each activation
// resets the baseline; when it ends (finish, unmount, tab-hide) the elapsed
// active interval is committed. Idle/planning/result-screen and "other tab"
// time is never attributed, and each minute is reported at most once, so stats
// stop over-reporting wall-clock time.
function useGatedStudyTime({ active, payloadFor }) {
  const baselineRef = useRef(Date.now());
  const startedRef = useRef(false);
  const activeRef = useRef(!!active);
  activeRef.current = !!active;
  const payloadRef = useRef(payloadFor);
  payloadRef.current = payloadFor;

  const commit = () => {
    if (!startedRef.current) return;
    const seconds = Math.round((Date.now() - baselineRef.current) / 1000);
    startedRef.current = false;
    send(payloadRef.current, seconds);
  };

  // Start/stop the interval as `active` toggles.
  useEffect(() => {
    if (activeRef.current && !startedRef.current) {
      baselineRef.current = Date.now();
      startedRef.current = true;
    } else if (!activeRef.current && startedRef.current) {
      commit();
    }
  });

  // Commit on tab-hide / page-leave; re-arm on return; final commit on unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (startedRef.current) commit();
      } else if (activeRef.current && !startedRef.current) {
        baselineRef.current = Date.now();
        startedRef.current = true;
      }
    };
    const onPageHide = () => commit();
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      commit();
    };
  }, []);
}

// Overall study-page timer: returns the live elapsed seconds for the visible
// counter (always ticking), but only RECORDS study seconds while `active` —
// e.g. on the Summary tab — so practice minutes (recorded by the section
// timers) are not double-counted.
export function useStudySession({ model, itemId, topic, active = true } = {}) {
  const startRef = useRef(Date.now()); // drives the visible counter only
  const [elapsed, setElapsed] = useState(0);
  useGatedStudyTime({ active, payloadFor: (s) => ({ model, item_id: itemId, seconds: s, topic }) });

  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  return elapsed;
}

// Per-section timer: attributes ACTIVE practice time (MCQ / CLOZE / FEYNMAN)
// to a source. The panel passes active = session is actually running (started
// and not finished), so only real practice minutes are recorded.
export function useStudySection({ model, itemId, method, topic, active = true } = {}) {
  useGatedStudyTime({ active, payloadFor: (s) => ({ model, item_id: itemId, seconds: s, method, topic }) });
}

export default useStudySession;