import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { srService } from '../../services/api/sr';
import StudyTimeChart from '../../components/common/StudyTimeChart';
import { lastWeekDays, monthWeekBuckets } from '../../utils/studyDays';
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
      <Box sx={{ width: `${Math.max(0, Math.min(100, value.percent))}%`, height: '100%', borderRadius: 999, background: 'var(--color-teal)' }} />
    </Box>
  </Box>
);

const MiniTime = ({ label, seconds }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block' }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: (seconds || 0) > 0 ? 'var(--color-white)' : 'color-mix(in srgb, var(--color-white) 35%, transparent)' }}>{fmtTime(seconds || 0)}</Typography>
  </Box>
);

const MetricView = ({ label, value }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--color-teal)' }}>{value}</Typography>
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
  const [error, setError] = useState(null);
  const [chartRange, setChartRange] = useState('week'); // 'week' | 'month'

  // Series for the study-activity plot: last 7 days (week) or the current
  // month grouped into calendar weeks (month).
  const statsDays = useMemo(
    () => (chartRange === 'month'
      ? monthWeekBuckets(stats?.study?.per_day)
      : lastWeekDays(stats?.study?.per_day, 7)),
    [stats, chartRange]
  );

  const weekSeconds = (stats?.study?.per_day || []).slice(-7).reduce((a, d) => a + (d.seconds || 0), 0);
  const monthSeconds = (stats?.study?.per_day || []).slice(-30).reduce((a, d) => a + (d.seconds || 0), 0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await srService.getStats();
      setStats(s);
    } catch (e) {
      setError(e?.message || 'Could not load your stats.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!stats) {
    // A failed load shouldn't hang on an infinite spinner — surface the error
    // with a retry instead.
    if (error) {
      return (
        <Box sx={{ minHeight: '100vh', width: '100%', background: 'var(--color-navy-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3, color: 'var(--color-white)' }}>
          <Typography sx={{ fontWeight: 800 }}>Couldn&apos;t load your stats</Typography>
          <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', textAlign: 'center', maxWidth: 380 }}>{error}</Typography>
          <Button onClick={load} sx={{ borderRadius: 999, px: 3, color: 'var(--color-teal)', border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)', textTransform: 'none', fontWeight: 700 }}>Try again</Button>
        </Box>
      );
    }
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
        <Button onClick={load} sx={{ borderRadius: 999, px: 3, py: 1, color: 'var(--color-teal)', border: '1px solid color-mix(in srgb, var(--color-teal) 45%, transparent)', textTransform: 'none', fontWeight: 700 }}>Refresh</Button>
      </Box>

      {/* Toppline cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        <StatCard icon={<LocalFireDepartmentIcon sx={{ color: 'var(--color-amber)' }} />} tint="var(--color-amber)" label="Streak" value={`${stats.streak.current} day${stats.streak.current === 1 ? '' : 's'}`} sub={stats.streak.today_active ? 'Active today' : 'Study today to keep it'} />
        <StatCard icon={<EmojiEventsIcon sx={{ color: 'var(--color-amber)' }} />} tint="var(--color-amber)" label="Longest streak" value={`${stats.streak.longest}`} sub={`Level ${stats.xp.level}`} />
        <StatCard icon={<ScheduleIcon sx={{ color: 'var(--color-teal)' }} />} tint="var(--color-teal)" label="Study time" value={fmtTime(stats.study?.total_seconds || 0)} sub="across all subjects" />
        <StatCard icon={<SelfImprovementIcon sx={{ color: 'var(--color-blue)' }} />} tint="var(--color-blue)" label="X.P." value={stats.xp.level} sub={`${stats.xp.total} total XP`} />
      </Box>

      {/* Study activity (week/month time-series plot) */}
      <Box sx={{ p: 3, borderRadius: 3, mb: 4, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Study activity</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.25, borderRadius: 999, bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
            {['week', 'month'].map((r) => (
              <Box key={r} onClick={() => setChartRange(r)} sx={{ px: 1.5, py: 0.5, borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', userSelect: 'none', color: chartRange === r ? 'var(--color-navy-deep)' : 'color-mix(in srgb, var(--color-white) 60%, transparent)', bgcolor: chartRange === r ? 'var(--color-teal)' : 'transparent' }}>{r === 'week' ? 'Week' : 'Month'}</Box>
            ))}
          </Box>
        </Box>
        <StudyTimeChart days={statsDays} tone="dark" />
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', display: 'flex', justifyContent: 'center', gap: 6 }}>
          <MetricView label="This week" value={fmtTime(weekSeconds)} />
          <MetricView label="This month" value={fmtTime(monthSeconds)} />
        </Box>
      </Box>

      {/* Feynman practice */}
      <Box sx={{ p: 3, borderRadius: 3, mb: 4, border: '1px solid color-mix(in srgb, var(--color-teal) 30%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Feynman practice</Typography>
        {!stats.feynman || stats.feynman.sessions === 0 ? (
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>
            No Feynman sessions recorded yet. Practice a Feynman prompt on any document, video or lecture.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: { xs: 3, sm: 6 }, flexWrap: 'wrap' }}>
            <MetricView label="Sessions" value={stats.feynman.sessions} />
            <MetricView label="Total time" value={fmtTime(stats.feynman.total_seconds || 0)} />
            <MetricView label="Average score" value={`${stats.feynman.avg_score}%`} />
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* accuracy */}
        <Box sx={{ p: 3, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Quiz accuracy</Typography>
          {mql.length === 0 ? (
            <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>No practice recorded yet. Keep answering MCQs, Cloze and Feynman prompts.</Typography>
          ) : mql.map((x) => <MethodPercent key={x.label} label={x.label} value={x.value} />)}
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

      {/* study time by source */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Study time by source</Typography>
        {!stats.study_sources || stats.study_sources.length === 0 ? (
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>No study time recorded yet — open a document, video, lecture or book and study it.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            {stats.study_sources.map((s) => (
              <Box key={`t-${s.type}-${s.id}`} sx={{ p: 2.5, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={s.type === 'document' ? 'Document' : s.type === 'book' ? 'Book' : s.type === 'video' ? 'Video' : 'Lecture'} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontSize: 11 }} />
                <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 15, minWidth: 0 }}>{s.title}</Typography>
                <Box sx={{ display: 'flex', gap: 1.75, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <MiniTime label="Overall" seconds={s.seconds} />
                  <MiniTime label="MCQ" seconds={s.methods?.MCQ || 0} />
                  <MiniTime label="Feynman" seconds={s.methods?.FEYNMAN || 0} />
                  <MiniTime label="Cloze" seconds={s.methods?.CLOZE || 0} />
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* per-source accuracy */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Accuracy by study source</Typography>
        {!stats.per_source || stats.per_source.length === 0 ? (
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', fontStyle: 'italic' }}>Answer quiz questions on a document, video, book or lecture to see its accuracy here.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            {stats.per_source.map((s) => (
              <Box key={`${s.type}-${s.id}`} sx={{ p: 2.5, borderRadius: 3, border: '1px solid color-mix(in srgb, var(--color-white) 12%, transparent)', bgcolor: 'color-mix(in srgb, var(--color-navy-700) 70%, transparent)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip size="small" label={s.type === 'document' ? 'Document' : s.type === 'video' ? 'Video' : 'Lecture'} sx={{ color: 'var(--color-teal)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontSize: 11 }} />
                  <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 15, minWidth: 0 }}>{s.title}</Typography>
                  <Typography sx={{ color: 'var(--color-teal)', fontWeight: 800, fontSize: 16 }}>{s.overall.percent}%</Typography>
                </Box>
                {['MCQ', 'CLOZE', 'FEYNMAN'].filter((m) => (s.methods?.[m]?.total || 0) > 0).map((m) => (
                  <MethodPercent key={m} label={m} value={s.methods[m]} />
                ))}
              </Box>
            ))}
          </Box>
        )}
      </Box>

    </Box>
  );
};

export default Stats;