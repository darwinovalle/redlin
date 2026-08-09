import React, { useId } from 'react';

// Lightweight responsive SVG area chart of study seconds per day. Shared by the
// Home page and /stats so the week/month study-time plots stay consistent.
const StudyTimeChart = ({ days = [], tone = 'light', labelEvery = 1 }) => {
  const gradientId = `studyAreaFill-${useId()}`;
  const W = 640, H = 190, PAD_L = 46, PAD_B = 26, PAD_T = 12;
  const innerW = W - PAD_L - 16;
  const innerH = H - PAD_T - PAD_B;

  const isDark = tone !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.09)';
  const textColor = isDark ? 'rgba(255,255,255,0.55)' : '#94A3B8';

  const maxSec = Math.max(1, ...days.map((d) => d.seconds || 0));
  const maxMin = Math.max(1, Math.round((maxSec / 60) * 10) / 10);
  const pts = days.map((d, i) => {
    const x = PAD_L + (i * innerW) / Math.max(1, days.length - 1);
    const y = H - PAD_B - ((d.seconds || 0) / maxSec) * innerH;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${line} L${(PAD_L + innerW).toFixed(1)} ${H - PAD_B} L${pts[0][0].toFixed(1)} ${H - PAD_B} Z`;
  const ticks = [0, 0.5, 1].map((g) => ({ value: maxMin * g, y: H - PAD_B - g * innerH }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t.y}>
          <line x1={PAD_L} x2={PAD_L + innerW} y1={t.y} y2={t.y} stroke={gridColor} strokeWidth="1" strokeDasharray="3 3" />
          <text x={PAD_L - 8} y={t.y + 4} textAnchor="end" style={{ fontSize: 11, fill: textColor }}>{Math.round(t.value)}m</text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--color-teal)" />)}
      {days.map((dd, i) => (
        (i % labelEvery === 0 || i === days.length - 1) && (
          <text key={i} x={pts[i][0]} y={H - 8} textAnchor="middle" style={{ fontSize: 11, fill: textColor, fontWeight: 600 }}>{dd.label}</text>
        )
      ))}
    </svg>
  );
};

export default StudyTimeChart;