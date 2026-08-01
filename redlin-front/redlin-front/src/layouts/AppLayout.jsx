import React from 'react';
import Box from '@mui/material/Box';
import { Outlet, useNavigate } from 'react-router-dom';
import WavyBackground from '../components/common/WavyBackground';
import MiniDrawer from '../pages/Dashboard/Sidebar';
import { useAuth } from '../context/AuthContext';

const AppLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
  <Box sx={{ position: 'relative', display: 'flex', width: '100%', minHeight: '100vh', zIndex: 5, background: '#e9e9e9', overflow: 'hidden' }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      {/* <Box sx={{ position: 'fixed', top: 10, left: 10, zIndex: 4000, bgcolor: '#20C997', color: '#fff', px: 1.5, py: 0.75, borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        APP LAYOUT
      </Box> */}
      {/* <WavyBackground waveHeight="60vh" offsetY={0} /> */}

      <MiniDrawer onLogout={() => { logout(); navigate('/login'); }} onOpenSettings={() => navigate('/settings')} />
      <Box component="main" id="main-content" tabIndex={-1} sx={{ position: 'relative', zIndex: 1, flexGrow: 1, minWidth: 0, minHeight: '100vh', display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch', overflowY: 'auto', pt: 0, mt: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
