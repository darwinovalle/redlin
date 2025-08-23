import { Route, Routes, BrowserRouter , Link} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CSVStudy from "./pages/CSVStudy";
import VideoStudy from "./pages/VideoStudy";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Checkout from "./pages/Checkout";
import ProtectRoute from "./components/ProtectRoute";
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';


const AppRouter = () => {
  return (
    <AuthProvider>
      <RouterContent />
    </AuthProvider>
  );
};

const RouterContent = () => {
  const { user, logout } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
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
    </BrowserRouter>
  );
};

 

export default AppRouter;