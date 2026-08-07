import React, { useCallback, useEffect, useState } from 'react';
import { srService } from '../../services/api/sr';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';

const fmtTime = (sec) => {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const MethodPercent = ({ label, value }) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>{value.percent}% · {value.correct}/{value.total}</Typography>
    </Box>
    <Box sx={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--color-white) 10%, transparent)' }}>
      <Box sx={{ width: `${Math.max(0, Math.min(100, value.percent))}%`, height: '100%', borderRadius: 999, background: 'var(--color-teal)', transition: 'width .4s' }} />
    </Box>
  </Box>
);

const StatCard = ({ icon, tint, label, value, sub }) => (
  <Box sx={{ p: 2.5, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Box sx={{ display: 'inline-flex', width: 36, height: 36, borderRadius: '10px', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${tint} 20%, transparent)` }}>{icon}</Box>
      <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
    </Box>
    <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
    {sub && <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>{sub}</Typography>}
  </Box>
);

const Stats = () => {
  const [stats, setStats] = useState(null);
  const [due, setDue] = useState({ items: [], count: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, d] = await Promise.all([srService.getStats(), srService.getDue()]);
      setStats(s);
      setDue(d || { items: [], count: 0 });
    } catch (e) {
      setError(e?.message || 'Could not load your stats.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const answer = async (item) => {
    setBusy(true);
    try {
      await srService.submitAttempt({
        content_type_id: item.content_type_id,
        object_id: item.object_id,
        method: item.method,
        correct: true,
      });
      await load();
    } catch (e) {
      window.alert(e?.response?.data?.error || 'Failed to record answer');
    } finally { setBusy(false); }
  };

  const answerWrong = async (item) => {
    setBusy(true);
    try {
      await srService.submitAttempt({
        content_type_id: item.content_type_id,
        object_id: item.object_id,
        method: item.method,
        correct: false,
      });
      await load();
    } catch (e) {
      window.alert(e?.response?.data?.error || 'Failed to record answer');
    } finally { setBusy(false); }
  };

  if (!stats) {
    return <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: 'var(--color-teal)' }} /></Box>;
  }

  const methods = stats.methods || {};
  const mql = ['MCQ', 'CLOZE', 'FEYNMAN', 'MIXED']
    .filter((m) => (methods[m]?.total || 0) > 0)
    .map((m) => ({ label: m, value: methods[m] }));

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', p: { xs: 3, md: 5 }, color: 'var(--color-white)' }}>
      {error && <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--color-danger-soft) 14%, transparent)' }}>{error}</Box>}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>Stats</Typography>
          <Typography variant="body1" sx={{ color: 'color-mix(in srgb, var(--color-white) 66%, transparent)' }}>
            Study time, per-quiz accuracy, your streak — and the reviews the spaced-repetition engine has scheduled for you.
          </Typography>
        </Box>
        <Button onClick={load} disabled={busy} sx={{ borderRadius: 999, px: 3, py: 1, color: 'var(--color-teal)', border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)', textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
      </Box>

      {/* Toppline cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B' }} />} tint="#F59E0B" label="Streak" value={`${stats.streak.current} day${stats.streak.current === 1 ? '' : 's'}`} sub={stats.streak.today_active ? 'Active today' : 'Study today to keep it'} />
        <StatCard icon={<EmojiEventsIcon sx={{ color: '#F59E0B' }} />} tint="#F59E0B" label="Longest streak" value={`${stats.streak.longest}`} sub={`Level ${stats.xp.level}`} />
        <StatCard icon={<ScheduleIcon sx={{ color: 'var(--color-teal)' }} />} tint="var(--color-teal)" label="Study time" value={fmtTime(stats.study?.total_seconds || 0)} sub="across all subjects" />
        <StatCard icon={<SelfImprovementIcon sx={{ color: '#38BDF8' }} />} tint="#38BDF8" label="X.P." value={stats.xp.level} sub={`${stats.xp.total} total XP`} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* accuracy */}
        <Box sx={{ p: 3, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quiz accuracy</Typography>
          {mT.length === 0 ? (
            <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>No practice recorded yet. Keep answering MCQs, Cloze and Feynman prompts.</Typography>
          ) : mT.map((x) => <MethodPercent key={x.label} label={x.label} value={x.value} />)}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 600 }}>Overall</Typography>
            <Typography sx={{ color: 'var(--color-teal)', fontWeight: 700 }}>{stats.overall.percent}% ({stats.overall.correct}/{stats.overall.total})</Typography>
          </Box>
        </Box>

        {/* study time per topic */}
        <Box sx={{ p: 3, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Study time per subject</Typography>
          {(!stats.study?.per_topic || stats.study.per_topic.length === 0) ? (
            <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>No study time logged yet. Use the timer on a subject board.</Typography>
          ) : stats.study.per_topic.map((t) => (
            <Box key={t.topic_id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t.topic__name}</Typography>
                <Typography sx={{ fontSize: 14, color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>{fmtTime(t.seconds)}</Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 999, background: 'color-mix(in srgb, var(--color-white) 10%, transparent)' }}>
                <Box sx={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--color-teal), var(--color-blue))', minWidth: 4 }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* due reviews */}
      <Box sx={{ p: 3, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-teal) 30%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Due for review</Typography>
          <Chip size="small" label={`${due.count} due`} sx={{ color: 'var(--color-white)', bgcolor: 'color-mix(in srgb, var(--color-teal) 20%, transparent)' }} />
          <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)' }}>Mark each as correct or wrong to advance its spaced-repetition schedule.</Typography>
        </Box>
        {due.items.length === 0 ? (
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>Nothing due right now. The engine will schedule reviews as you study.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {due.items.map((it) => (
              <Box key={it.progress_id} sx={{ p: 2, borderRadius: 2, border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-white) 5%, transparent)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={it.method} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontSize: 11 }} />
                <Typography sx={{ flex: 1, minWidth: 180, fontSize: 14 }}>{it.question}</Typography>
                <Chip size="small" label={`every ${it.interval_days}d`} sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', fontSize: 11 }} />
                <Button size="small" disabled={busy} onClick={() => answer(it)} sx={{ borderRadius: '999px', px: 2, color: 'var(--color-navy-deep)', bgcolor: 'var(--color-teal)', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: 'var(--color-teal-pale)' } }}>Got it</Button>
                <Button size="small" disabled={busy} onClick={() => answerWrong(it)} sx={{ borderRadius: '999px', px: 2, color: 'var(--color-white)', border: '1px solid color-mix(in srgb, var(--color-white) 25%, transparent)', textTransform: 'none', fontWeight: 700 }}>Again</Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Stats;