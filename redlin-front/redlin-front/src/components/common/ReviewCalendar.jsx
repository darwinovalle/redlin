import React, { useState } from 'react';
import { srService } from '../../services/api/sr';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

const WEEK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Home-header calendar button: opens a month-grid popover showing which days
// have SM-2 review sessions scheduled, with month navigation and the next
// upcoming sessions listed below.
const ReviewCalendar = () => {
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);
  const [data, setData] = useState(null);
  const [view, setView] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const today = new Date();
  const todayISO = isoDate(today);
  const curMonthIndex = today.getFullYear() * 12 + today.getMonth();
  const viewMonthIndex = view.getFullYear() * 12 + view.getMonth();

  const openMenu = (e) => {
    setAnchor(e.currentTarget);
    srService.getReviewCalendar().then(setData).catch(() => {});
  };

  const byDay = (data?.days || []).reduce((m, d) => { m[d.date] = d.count; return m; }, {});
  const upcoming = data?.upcoming || [];

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  return (
    <>
      <div className="action-btn" onClick={openMenu} aria-label="Review calendar" title="Review calendar">
        <i className="ri-calendar-line" />
      </div>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 320, mt: 1, borderRadius: 2, backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-border-faint)',
              boxShadow: '0 18px 48px color-mix(in srgb, var(--color-navy) 18%, transparent)',
              color: 'var(--color-navy-deep)', overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Month navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <IconButton size="small" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} disabled={viewMonthIndex === curMonthIndex} sx={{ color: 'var(--color-text-mid)' }}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{view.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</Typography>
            <IconButton size="small" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} sx={{ color: 'var(--color-text-mid)' }}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Weekday header */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
            {WEEK_LABELS.map((w) => (
              <Typography key={w} sx={{ fontSize: 9, fontWeight: 700, textAlign: 'center', color: 'var(--color-text-mid)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{w}</Typography>
            ))}
          </Box>

          {/* Day grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.25 }}>
            {cells.map((d, i) => {
              if (!d) return <Box key={`empty-${i}`} />;
              const dayISO = isoDate(new Date(view.getFullYear(), view.getMonth(), d));
              const count = byDay[dayISO] || 0;
              const isToday = dayISO === todayISO;
              return (
                <Box key={dayISO} sx={{ height: 32, borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: isToday ? 'var(--color-cloud)' : 'transparent', border: isToday ? '1px solid var(--color-teal)' : '1px solid transparent' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: count > 0 ? 700 : 400, color: count > 0 ? 'var(--color-teal-deep)' : 'var(--color-navy-deep)' }}>{d}</Typography>
                  {count > 0 && <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'var(--color-teal)', mt: 1 }} />}
                  {count > 1 && (
                    <Typography sx={{ position: 'absolute', top: 1, right: 2, fontSize: 8, fontWeight: 700, color: 'var(--color-blue)' }}>
                      {count > 9 ? '9+' : count}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Next sessions */}
          {(data === null) ? (
            <Typography sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--color-border-faint)', fontSize: 12, color: 'var(--color-text-mid)' }}>Loading schedule…</Typography>
          ) : upcoming.length === 0 ? (
            <Typography sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--color-border-faint)', fontSize: 12, color: 'var(--color-text-mid)' }}>
              No upcoming review sessions.
            </Typography>
          ) : (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--color-border-faint)' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-text-mid)', mb: 1 }}>Next sessions</Typography>
              {upcoming.slice(0, 5).map((s, i) => (
                <Box key={`${s.date}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4 }}>
                  <Typography sx={{ fontSize: 11, color: 'var(--color-text-mid)', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.date.slice(5).replace('-', '/')}</Typography>
                  <Chip size="small" label={s.method} sx={{ fontSize: 10, height: 18, bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', color: 'var(--color-teal-deep)', fontWeight: 700 }} />
                  <Typography sx={{ fontSize: 12, color: 'var(--color-navy-deep)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{s.question}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
};

// ISO helper scoped below usage to avoid a stray reference.
const iso = (d) => isoDate(d);

export default ReviewCalendar;