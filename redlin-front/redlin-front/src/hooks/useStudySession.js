import { useEffect, useRef } from 'react';
import { srService } from '../services/api/sr';

const MIN_SECONDS = 3;

// Silently tracks how long a study panel stays open and records it to the
// stats engine on leave (or when the tab hides). Pass the opened resource via
// {model, itemId} (e.g. model:'document'|'video'|'lecture', itemId:<row id>).
export function useStudySession({ model, itemId, topic } = {}) {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const commit = () => {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      if (seconds >= MIN_SECONDS) {
        srService.recordStudy({ model, item_id: itemId, seconds, topic }).catch(() => {});
      }
    };
    const onVisibility = () => { if (document.hidden) commit(); };
    window.addEventListener('pagehide', commit);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', commit);
      document.removeEventListener('visibilitychange', onVisibility);
      commit();
    };
  }, [model, itemId, topic]);
}

export default useStudySession;