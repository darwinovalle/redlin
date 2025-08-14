import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import { useAuth } from '../../context/AuthContext';

// Small helper to track a simple daily streak locally (no backend dependency)
function useDailyStreak(userId) {
  const key = useMemo(() => `streak:${userId}`, [userId]);
  const [streak, setStreak] = useState(0);
  const [last, setLast] = useState(null);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        setStreak(data.count || 0);
        setLast(data.lastDate || null);
      }
    } catch {}
  }, [key, userId]);

  // Touch today to maintain the streak (opening Home counts as engagement)
  useEffect(() => {
    if (!userId) return;
    const today = new Date();
    const toISO = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const todayISO = toISO(today);
    const lastISO = last;
    if (lastISO === todayISO) return; // already counted today
    let next = 1;
    if (lastISO) {
      const lastDate = new Date(lastISO);
      const diffDays = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));
      next = diffDays === 1 ? (streak || 0) + 1 : 1;
    }
    setStreak(next);
    setLast(todayISO);
    try { localStorage.setItem(key, JSON.stringify({ count: next, lastDate: todayISO })); } catch {}
  }, [userId, last, streak, key]);

  return streak;
}

const Home = () => {
  const { user } = useAuth();
  const streak = useDailyStreak(user?.id);

  // Local daily goal progress (simple local storage state)
  const goalKey = useMemo(() => `goal:${user?.id}:today`, [user?.id]);
  const [done, setDone] = useState(0);
  const dailyGoal = 1; // minimal viable: 1 action per day

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(goalKey);
      const today = new Date();
      const todayISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const data = raw ? JSON.parse(raw) : { date: todayISO, count: 0 };
      if (data.date !== todayISO) {
        localStorage.setItem(goalKey, JSON.stringify({ date: todayISO, count: 0 }));
        setDone(0);
      } else {
        setDone(data.count || 0);
      }
    } catch {}
  }, [goalKey, user]);

//   const markOne = () => {
//     const today = new Date();
//     const todayISO = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
//     const next = Math.min(done + 1, dailyGoal);
//     setDone(next);
//     try { localStorage.setItem(goalKey, JSON.stringify({ date: todayISO, count: next })); } catch {}
//     const last = localStorage.getItem('lastDocSlug');
//     if (last) {
//       navigate(`/documents/${last}`);
//     } else {
//       navigate('/documents/primero');
//     }
//   };

  return (
    <Box sx={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Welcome */}
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                background: 'linear-gradient(90deg, #0f172a 0%, #111827 30%, #2563eb 80%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {`Bienvenido${user?.username ? ',' : ''} ${user?.username || ''}`}
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Tu racha actual: {streak} {streak === 1 ? 'día' : 'días'} 🔥
            </Typography>
          </Box>

          {/* Daily progress widgets */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, alignItems: 'stretch' }}>
            {/* Streak calendar */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Progreso diario</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Comienza tu streak</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d) => (
                  <Typography key={d} variant="caption" sx={{ textAlign: 'center', color: 'text.secondary' }}>{d}</Typography>
                ))}
                {Array.from({ length: 28 }).map((_, i) => {
                  const filled = i < Math.min(streak, 28); // simple visual fill
                  return (
                    <Box key={i}
                      sx={{
                        width: 26, height: 26, borderRadius: '50%', mx: 'auto',
                        bgcolor: filled ? 'primary.main' : 'action.hover',
                        opacity: filled ? 0.9 : 0.5,
                      }}
                    />
                  );
                })}
              </Box>
            </Paper>

            {/* Daily goal ring */}
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Meta diaria</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Pregunta para tu streak</Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                <CircularProgress variant="determinate" value={(done / dailyGoal) * 100} size={160} thickness={5} />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 900 }}>{dailyGoal}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>pregunta</Typography>
                  </Box>
                </Box>
              </Box>
              {/* <Button variant="contained" onClick={markOne} sx={{ borderRadius: 999, px: 4 }}>Aprender</Button> */}
            </Paper>
          </Box>
    </Box>
  );
};

export default Home;
