import { Route, Routes, BrowserRouter , Link} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Checkout from "./pages/Checkout";
import ProtectRoute from "./components/ProtectRoute";
import { AuthProvider, useAuth } from './context/AuthContext';


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
        <Route path="/documents/:docSlug" element={
          <ProtectRoute user={user}>
            <Dashboard />
          </ProtectRoute>
        } />
        <Route path="/home" element={
          <ProtectRoute user={user}>
            <Home />
          </ProtectRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectRoute user={user}>
            <Dashboard />
          </ProtectRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

 

export default AppRouter;