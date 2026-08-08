import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService, SESSION_EXPIRED_EVENT } from '../services/api';

// 30 minutes of no real user interaction → session expires and the user is
// redirected to /login with a "Session expired" modal.
const IDLE_MS = 30 * 60 * 1000;
// Activity heartbeats are throttled so a burst of scroll/move events doesn't
// hammer the API. The backend also throttles writes to once per 60s.
const HEARTBEAT_MS = 60 * 1000;
// How often the local timer checks whether the user went idle.
const CHECK_MS = 15 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * Mount once in the authenticated app shell (AppLayout).
 *
 * Two layers of enforcement:
 *  1. Local: resets on real user input; after IDLE_MS without any, force logout.
 *  2. Server: every authenticated request carries the idle check, so a stale
 *     session is also killed on the next API call (interceptor raises
 *     SESSION_EXPIRED_EVENT and this hook reacts to it).
 */
const useSessionIdleTimeout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const lastBeatRef = useRef(0);
  const expiredRef = useRef(false);

  const handleExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    // Flag survives the redirect so the Login page can show the explanation.
    try { sessionStorage.setItem('redlin_session_expired', '1'); } catch {}
    // Navigate to the public route first, then drop the auth state — otherwise
    // ProtectRoute would bounce the session-expired user to the landing page.
    navigate('/login', { replace: true });
    logout();
  }, [navigate, logout]);

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      const now = Date.now();
      if (now - lastBeatRef.current >= HEARTBEAT_MS) {
        lastBeatRef.current = now;
        // Fire-and-forget; a 401 code=session_expired here is caught by the
        // interceptor, which dispatches SESSION_EXPIRED_EVENT below.
        authService.activity().catch(() => {});
      }
    };
    const onSessionExpired = () => handleExpire();

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_MS) {
        handleExpire();
      }
    }, CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
      window.clearInterval(timer);
    };
  }, [handleExpire]);

  return null;
};

export default useSessionIdleTimeout;
