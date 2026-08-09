import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { srService } from '../../services/api/sr';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';

// Notification bell: polls /api/reminders/, shows an unread badge, and opens a
// popup with the daily "due for review" reminders.
// tone: "dark" (dark sidebar, white icon) or "light" (light pages, dark icon).
const NotificationBell = ({ tone = 'dark' }) => {
  const isDark = tone !== 'light';
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [unread, setUnread] = useState(0);
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);

  const load = async () => {
    try {
      const d = await srService.getReminders();
      setReminders(d?.items || []);
      setUnread(d?.unread || 0);
    } catch { /* keep the badge as-is if the API is busy */ }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, []);

  const openMenu = (e) => {
    setAnchor(e.currentTarget);
    // Opening the popup marks the current reminders as read.
    reminders.filter((r) => !r.read_at).forEach((r) => {
      srService.markReminderRead(r.id).then(() => {}).catch(() => {});
    });
    setUnread(0);
  };

  return (
    <>
      <IconButton aria-label="Notifications" onClick={openMenu} sx={isDark ? { color: 'rgba(255,255,255,0.75)', '&:hover': { color: 'var(--color-white)', backgroundColor: 'rgba(255,255,255,0.08)' } } : { color: 'var(--color-text-mid)', '&:hover': { color: 'var(--color-blue)', backgroundColor: 'var(--color-cloud)' } }}>
        <Badge badgeContent={unread} color="error" overlap="circular">
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 340, maxHeight: 380, overflowY: 'auto', mt: 1, borderRadius: 2,
              backgroundColor: 'var(--color-navy-700)', color: 'var(--color-white)',
              border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
              boxShadow: '0 18px 48px color-mix(in srgb, var(--color-black) 40%, transparent)',
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Reminders</Typography>
          {reminders.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>No reminders yet.</Typography>
          ) : reminders.map((r) => (
            <Box key={r.id} sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 4%, transparent)' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.subject}</Typography>
              {r.payload?.methods && Object.keys(r.payload.methods).length > 0 && (
                <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
                  {Object.entries(r.payload.methods).map(([m, n]) => `${m}: ${n}`).join(' · ')}
                </Typography>
              )}
              <Button size="small" onClick={() => { setAnchor(null); navigate('/stats'); }} sx={{ mt: 0.5, color: 'var(--color-teal)', textTransform: 'none', fontWeight: 700, fontSize: 13 }}>Review now</Button>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;