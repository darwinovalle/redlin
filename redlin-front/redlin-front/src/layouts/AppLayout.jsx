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
  <Box sx={{ position: 'relative', display: 'flex', height: '100vh', bgcolor: 'transparent', zIndex: 5 }}>
      <WavyBackground waveHeight="60vh" offsetY={0} />
      <MiniDrawer onLogout={() => { logout(); navigate('/login'); }} />
      <Box sx={{ position: 'relative', zIndex: 1, flexGrow: 1, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', pt: 0, mt: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
