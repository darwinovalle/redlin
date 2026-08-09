import React, { useState } from 'react';
import Box from '@mui/material/Box';
import { Outlet, useNavigate } from 'react-router-dom';
import WavyBackground from '../components/common/WavyBackground';
import MiniDrawer from '../pages/Dashboard/Sidebar';
import ApiSettingsModal from '../components/common/ApiSettingsModal';
import { useAuth } from '../context/AuthContext';
import useSessionIdleTimeout from '../hooks/useSessionIdleTimeout';

const AppLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Inactivity session timeout: auto-logout + redirect to /login after 30 min idle.
  useSessionIdleTimeout();

  return (
  <Box sx={{ position: 'relative', display: 'flex', width: '100%', minHeight: '100vh', zIndex: 5, background: 'var(--color-shell)', overflow: 'hidden' }}>
      <a href="#main-content" className="skip-link">Skip to content</a>

      <MiniDrawer
        onLogout={() => { logout(); navigate('/'); }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ApiSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <Box component="main" id="main-content" tabIndex={-1} sx={{ position: 'relative', zIndex: 1, flexGrow: 1, minWidth: 0, minHeight: '100vh', display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch', overflowY: 'auto', pt: { xs: '56px', md: 0 }, mt: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
