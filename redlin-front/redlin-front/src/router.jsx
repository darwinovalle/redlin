import { lazy, Suspense, useEffect, useRef } from 'react';
import { Route, Routes, BrowserRouter, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import ProtectRoute from "./components/ProtectRoute";
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage/LandingPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const CSVStudy = lazy(() => import('./pages/CSVStudy'));
const VideoStudy = lazy(() => import('./pages/VideoStudy'));
const Home = lazy(() => import('./pages/Home'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Checkout = lazy(() => import('./pages/Checkout'));


const AppRouter = () => {
  return (
    <AuthProvider>
      <RouterContent />
    </AuthProvider>
  );
};

const RouteTransitionOverlay = () => {
  const { pathname } = useLocation();
  const overlayRef = useRef(null);
  const topPanelRef = useRef(null);
  const bottomPanelRef = useRef(null);
  const shineRef = useRef(null);
  const didFirstRenderRef = useRef(false);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    const overlay = overlayRef.current;
    const topPanel = topPanelRef.current;
    const bottomPanel = bottomPanelRef.current;
    const shine = shineRef.current;
    if (!overlay || !topPanel || !bottomPanel || !shine) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      gsap.set(overlay, { autoAlpha: 0 });
      previousPathRef.current = pathname;
      didFirstRenderRef.current = true;
      return undefined;
    }

    if (!didFirstRenderRef.current) {
      didFirstRenderRef.current = true;
      previousPathRef.current = pathname;
      gsap.set(overlay, { autoAlpha: 0 });
      return undefined;
    }

    if (previousPathRef.current === pathname) return undefined;
    previousPathRef.current = pathname;

    const timeline = gsap.timeline({ defaults: { ease: 'power4.inOut' } });
    timeline
      .set(overlay, {
        autoAlpha: 1,
      })
      .set([topPanel, bottomPanel], {
        yPercent: 0,
        force3D: true,
      })
      .fromTo(
        shine,
        { autoAlpha: 0.2, xPercent: -22, scaleX: 0.88 },
        { autoAlpha: 0.56, xPercent: 22, scaleX: 1.08, duration: 0.64, ease: 'sine.inOut' },
        0
      )
      .to(topPanel, { yPercent: -102, duration: 0.78 }, 0.08)
      .to(bottomPanel, { yPercent: 102, duration: 0.78 }, 0.08)
      .to(shine, { autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0.24)
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.02,
          ease: 'none',
        },
        0.86
      );

    return () => {
      timeline.kill();
    };
  }, [pathname]);

  return (
    <div ref={overlayRef} className="route-transition-overlay" aria-hidden="true">
      <div ref={topPanelRef} className="route-transition-panel route-transition-panel-top" />
      <div ref={bottomPanelRef} className="route-transition-panel route-transition-panel-bottom" />
      <div ref={shineRef} className="route-transition-overlay-shine" />
    </div>
  );
};

const RouterContent = () => {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <RouteTransitionOverlay />
      <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/checkout" element={<Checkout />} />
          {/* Protected app shell keeps Sidebar mounted */}
          <Route element={
            <ProtectRoute user={user}>
              <AppLayout />
            </ProtectRoute>
          }>
            <Route path="/home" element={<Home />} />
            <Route path="/documents/:docSlug" element={<Dashboard />} />
            <Route path="/csv/:csvSlug" element={<CSVStudy />} />
            <Route path="/videos/:videoId" element={<VideoStudy />} />
            {/* Optional alias */}
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

 

export default AppRouter;