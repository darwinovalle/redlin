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
const Classroom = lazy(() => import('./pages/Classroom'));
const Home = lazy(() => import('./pages/Home'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Checkout = lazy(() => import('./pages/Checkout'));
{/* Settings moved to ApiSettingsModal */}


const AppRouter = () => {
  return (
    <AuthProvider>
      <RouterContent />
    </AuthProvider>
  );
};

const RouteTransitionOverlay = () => {
  return null;
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
            <Route path="/classroom/:sessionId" element={<Classroom />} />
            {/* Optional alias */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* /settings is now a modal triggered from the sidebar */}
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

 

export default AppRouter;