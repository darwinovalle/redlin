import { lazy, Suspense, useEffect, useRef } from 'react';
import { Route, Routes, BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import ProtectRoute from "./components/ProtectRoute";
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
// LandingPage is intentionally not routed — "/" now serves the Login template.
// import LandingPage from './pages/LandingPage/LandingPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Documents = lazy(() => import('./pages/Documents'));
const CSVStudy = lazy(() => import('./pages/CSVStudy'));
const Videos = lazy(() => import('./pages/Videos'));
const VideoStudy = lazy(() => import('./pages/VideoStudy'));
const Classroom = lazy(() => import('./pages/Classroom'));
const ClassroomDirectory = lazy(() => import('./pages/ClassroomDirectory'));
const Books = lazy(() => import('./pages/Books'));
const BookDetail = lazy(() => import('./pages/Books/BookDetail'));
const BookUpload = lazy(() => import('./pages/Books/BookUpload'));
const BookChapterStudy = lazy(() => import('./pages/Books/BookChapterStudy'));
const Subjects = lazy(() => import('./pages/Subjects'));
const SubjectBoard = lazy(() => import('./pages/Subjects/Board'));
const Stats = lazy(() => import('./pages/Stats'));
const Home = lazy(() => import('./pages/Home'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Checkout = lazy(() => import('./pages/Checkout'));
const NotFound = lazy(() => import('./pages/NotFound'));
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
          {/* "/" is the login template (not a landing hero). Signed-in users go straight to /home. */}
          <Route path="/" element={user ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<NotFound />} />
          {/* Protected app shell keeps Sidebar mounted */}
          <Route element={
            <ProtectRoute user={user}>
              <AppLayout />
            </ProtectRoute>
          }>
            <Route path="/home" element={<Home />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:docSlug" element={<Dashboard />} />
            <Route path="/csv/:csvSlug" element={<CSVStudy />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/videos/:videoId" element={<VideoStudy />} />
            <Route path="/classroom" element={<ClassroomDirectory />} />
            <Route path="/classroom/:sessionId" element={<Classroom />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:topicId" element={<SubjectBoard />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/books" element={<Books />} />
            <Route path="/books/new" element={<BookUpload />} />
            <Route path="/books/:bookId" element={<BookDetail />} />
            <Route path="/books/:bookId/chapters/:chapterId" element={<BookChapterStudy />} />
            {/* Optional alias */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* /settings is now a modal triggered from the sidebar */}
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

 

export default AppRouter;