// Build study-time series for the week/month plots, shared by /home and /stats.
// Each input row is `{ started_at__date: 'YYYY-MM-DD', seconds }` from /api/stats/.

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toDayMap = (perDay = []) => {
  const map = {};
  for (const d of perDay) map[d.started_at__date] = d.seconds || 0;
  return map;
};

// Week view: the last `n` days, labeled with short weekday names.
export const lastWeekDays = (perDay, n = 7) => {
  const map = toDayMap(perDay);
  const today = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), seconds: map[isoDate(d)] || 0 });
  }
  return out;
};

// Month view: the current calendar month grouped into Monday-starting weeks,
// so the chart reads as a few week buckets instead of ~30 thin daily bars.
export const monthWeekBuckets = (perDay) => {
  const map = toDayMap(perDay);
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first offset for the 1st
  const lastDay = new Date(y, m + 1, 0).getDate();
  const weekCount = Math.ceil((offset + lastDay) / 7);

  const weeks = [];
  for (let k = 0; k < weekCount; k += 1) {
    const ws = new Date(y, m, 1 - offset + k * 7); // this week's Monday
    let seconds = 0;
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(y, m, 1 - offset + k * 7 + i, 12); // noon avoids DST rollover
      if (day.getFullYear() === y && day.getMonth() === m && day <= today) {
        seconds += map[isoDate(day)] || 0;
      }
    }
    weeks.push({
      label: ws.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      seconds,
    });
  }
  return weeks;
};