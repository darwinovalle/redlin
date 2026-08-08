import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHomeAnimations } from '../../hooks/useHomeAnimations';
import { srService } from '../../services/api/sr';
import { documentService } from '../../services/api';
import { videoService } from '../../services/api/video';
import { classroomService } from '../../services/api/classroom';
import './Home.css';

const fmtStudy = (s) => {
  const m = Math.round((s || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

// Lightweight SVG area chart: study seconds per day.
const StudyChart = ({ days }) => {
  const W = 620, H = 180, PAD = 26;
  const max = Math.max(1, ...days.map((d) => d.seconds));
  const pts = days.map((d, i) => {
    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, days.length - 1);
    const y = H - PAD - (d.seconds / max) * (H - PAD * 2);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - PAD} L${pts[0][0].toFixed(1)} ${H - PAD} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="homeAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={PAD} x2={W - PAD} y1={H - PAD - (g * (H - PAD * 2))} y2={H - PAD - (g * (H - PAD * 2))} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#homeAreaFill)" />
      <path d={line} fill="none" stroke="var(--color-teal)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--color-teal)" />)}
      {days.map((d, i) => (
        <text key={i} x={pts[i][0]} y={H - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'rgba(255,255,255,0.55)' }}>{d.label}</text>
      ))}
    </svg>
  );
};

// Local streak hook (unchanged core logic)
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

  useEffect(() => {
    if (!userId) return;
    const today = new Date();
    const dateFloor = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const todayISO = dateFloor(today);
    if (last === todayISO) return;
    let next = 1;
    if (last) {
      const lastDate = new Date(last);
      const diff = Math.round((today - lastDate) / 86400000);
      next = diff === 1 ? (streak || 0) + 1 : 1;
    }
    setStreak(next);
    setLast(todayISO);
    try { localStorage.setItem(key, JSON.stringify({ count: next, lastDate: todayISO })); } catch {}
  }, [userId, last, streak, key]);

  return streak;
}

const milestonesSeed = [
  { label: 'Basics', status: 'completed' },
  { label: 'ML Concepts', status: 'completed' },
  { label: 'Neural Networks', status: 'completed' },
  { label: 'Deep Learning', status: 'current' },
  { label: 'NLP', status: 'pending' },
  { label: 'Final Project', status: 'pending' }
];

const upcomingSeed = [
  { day: 15, month: 'Jun', title: 'Deep Learning Fundamentals', time: '10:00 AM - 11:30 AM' },
  { day: 18, month: 'Jun', title: 'Neural Networks Workshop', time: '2:00 PM - 4:00 PM' }
];

const accessSeed = [
  { icon: 'ri-file-text-line', title: 'Deep Learning Fundamentals', info: 'Last accessed 2 hours ago' },
  { icon: 'ri-video-line', title: 'Neural Networks Video Tutorial', info: 'Last accessed yesterday' },
  { icon: 'ri-file-list-3-line', title: 'ML Algorithms Study Sheet', info: 'Last accessed 3 days ago' },
  { icon: 'ri-question-answer-line', title: 'AI Ethics Quiz', info: 'Last accessed 1 week ago' }
];

const achievementsSeed = [
  { icon: 'ri-medal-line', color: 'var(--color-blue)', title: 'First Milestone', desc: 'Completed Basics Module' },
  { icon: 'ri-fire-line', color: 'var(--color-purple)', title: (s)=> `${s}-Day Streak`, desc: 'Keep it going!' },
  { icon: 'ri-book-mark-line', color: 'var(--color-teal)', title: 'Knowledge Hunter', desc: 'Completed 5 lessons' }
];

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const streak = stats?.streak?.current || 0;
  const dailyGoal = 1;

  // Load the user's real study resources for "Upcoming Sessions".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = [];
      try { const d = await documentService.getUserDocuments(user?.id); out.push(...(Array.isArray(d) ? d : []).map((x) => ({ kind: 'document', id: x.id, title: x.title }))); } catch {}
      try { const b = await documentService.listBooks(); out.push(...(Array.isArray(b) ? b : []).map((x) => ({ kind: 'book', id: x.id, title: x.title }))); } catch {}
      try { const v = await videoService.listVideos(); out.push(...(Array.isArray(v) ? v : []).map((x) => ({ kind: 'video', id: x.id, title: x.title || x.video_id || 'Video' }))); } catch {}
      try { const l = await classroomService.listSessions(); out.push(...(Array.isArray(l) ? l : []).map((x) => ({ kind: 'lecture', id: x.id, title: x.title }))); } catch {}
      if (!cancelled) setSessions(out.slice(0, 6));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const mainContentRef = useRef(null);
  const welcomeRef = useRef(null);
  const learningPathRef = useRef(null);
  const progressSectionRef = useRef(null);
  const upcomingSectionRef = useRef(null);
  const statsCardRef = useRef(null);
  const quickAccessRef = useRef(null);
  const achievementsRef = useRef(null);

  const animationRefs = {
    mainContentRef,
    welcomeRef,
    learningPathRef,
    progressSectionRef,
    upcomingSectionRef,
    statsCardRef,
    quickAccessRef,
    achievementsRef
  };

  useHomeAnimations(animationRefs);

  // Real dashboard data from the SR/stats engine.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await srService.getStats();
        if (!cancelled) setStats(s);
      } catch { /* keep the page usable if the API is busy */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const done = stats?.today?.attempts ?? 0;

  // Weekly study-time bars from real per-day study seconds.
  const chartData = useMemo(() => {
    const perDay = stats?.study?.per_day || [];
    const days = perDay.slice(-7).map((d) => ({
      label: (() => { try { return new Date(`${d.started_at__date}T00:00:00`).toLocaleDateString('en', { weekday: 'short' }); } catch { return ''; } })(),
      seconds: d.seconds || 0,
    }));
    if (!days.length) return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label) => ({ label, pct: 2 }));
    const max = Math.max(1, ...days.map((d) => d.seconds));
    return days.map((d) => ({ ...d, pct: d.seconds > 0 ? Math.max(6, Math.round((d.seconds / max) * 100)) : 2 }));
  }, [stats]);

  const slugify = (str) => (str || '').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
  const sessionUrl = (s) => (s.kind === 'video' ? `/videos/${s.id}` : s.kind === 'lecture' ? `/classroom/${s.id}` : s.kind === 'book' ? `/books/${s.id}` : `/documents/${slugify(s.title)}`);
  const quickSources = (stats?.study_sources || []).slice(0, 5);
  const chartDays = useMemo(() => {
    const byDay = {};
    for (const d of (stats?.study?.per_day || [])) byDay[d.started_at__date] = d.seconds || 0;
    const out = [];
    const today = new Date();
    for (let i = 13; i >= 0; i -= 1) {
      const dd = new Date(today); dd.setDate(dd.getDate() - i);
      out.push({ label: dd.toLocaleDateString('en', { weekday: 'short' }), seconds: byDay[dd.toISOString().slice(0, 10)] || 0 });
    }
    return out;
  }, [stats]);

  // Build calendar week (Mon-Sun) simple representation 1..7 with active today index
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; // display labels; the calendar's first day is Monday
  const todayIndex = ((new Date().getDay() + 6) % 7); // convert Sunday(0) -> 6

  const percent = Math.min(100, (done / dailyGoal) * 100);

  // Which visible days are part of the current streak (fire markers).
  const streakEndDate = stats?.streak?.last_active_date ? new Date(`${stats.streak.last_active_date}T00:00:00`) : new Date();
  const streakDaysSet = new Set();
  for (let i = 0; i < (stats?.streak?.current || 0); i += 1) {
    const d = new Date(streakEndDate);
    d.setDate(d.getDate() - i);
    streakDaysSet.add(d.toDateString());
  }
  const monday = new Date();
  monday.setDate(monday.getDate() - todayIndex);
  const dayFire = weekdays.map((_, idx) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + idx);
    return streakDaysSet.has(d.toDateString());
  });

  return (
    <div className="home-main-content" ref={mainContentRef}>
      {/* <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 9999, background: 'var(--color-teal)', color: 'var(--color-white)', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
        HOME MOUNTED
      </div> */}
      {/* Header */}
      <div className="header" ref={welcomeRef}>
        <div className="welcome">
          <div className="user-avatar">{(user?.username || '?').charAt(0).toUpperCase()}</div>
          <div className="welcome-text">
            <h2>Welcome{user?.username ? ',' : ''} {user?.username || ''}</h2>
            <div className="streak">
              <i className="ri-fire-fill" />
              <span>Current streak: {streak} {streak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <div className="action-btn"><i className="ri-notification-3-line" /></div>
          <div className="action-btn"><i className="ri-calendar-line" /></div>
        </div>
      </div>

      {/* Learning Path */}
      <div className="learning-path" ref={learningPathRef}>
        <div className="path-header">
          <div className="path-title">Your Learning Journey</div>
          <div className="section-action">View Details</div>
        </div>
        <p>Track your progress through the AI fundamentals course</p>
        <div className="path-timeline">
          {milestonesSeed.map(m => (
            <div key={m.label} className={`milestone ${m.status}`}> 
              <div className="milestone-dot" />
              <div className="milestone-label" title={m.label}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Section */}
      <div className="progress-section" ref={progressSectionRef}>
        <div className="card progress-card">
          <div className="progress-card-header"><h3>Daily progress</h3></div>
          <div className="progress-card-content">
            <div className="calendar">
              {weekdays.map((d, idx) => {
                const dayNum = idx + 1;
                const active = idx === todayIndex;
                const completed = idx < todayIndex; // naive representation
                const fire = dayFire[idx];
                return (
                  <div key={d} className="calendar-day">
                    <div className="day-label">{d}</div>
                    <div className={`day-circle ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>{fire ? '🔥' : dayNum}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card progress-card">
          <div className="progress-card-header"><h3>Daily goal</h3></div>
          <div className="progress-card-content">
            <div className="goal-progress">
              <div className="circular-progress" style={{ background: `conic-gradient(var(--color-teal) 0% ${percent}%, var(--color-cloud) ${percent}%, var(--color-cloud) 100%)` }}>
                <div className="progress-value">{done}/{dailyGoal}</div>
              </div>
              <div className="goal-text">{done >= dailyGoal ? 'You completed your daily goal' : 'Progress toward your goal'}</div>
              <div className="goal-label">{dailyGoal} question{dailyGoal!==1?'s':''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Sessions */}
      <div className="section upcoming-section" ref={upcomingSectionRef}>
        <div className="section-header">
          <h3 className="section-title">Upcoming Sessions</h3>
          <div className="section-action">View All</div>
        </div>
        <div className="timeline">
          {sessions.length === 0 ? (
            <div className="timeline-item">
              <div className="timeline-content">
                <div className="timeline-info"><h4>No study sessions yet</h4><p>Add a document, video, book or lecture to get started.</p></div>
              </div>
            </div>
          ) : sessions.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="timeline-item" onClick={() => navigate(sessionUrl(item))} style={{ cursor: 'pointer' }}>
              <div className="timeline-date">
                <div className="date-day">{item.kind === 'video' ? '🎬' : item.kind === 'lecture' ? '🎙️' : item.kind === 'book' ? '📚' : '📄'}</div>
                <div className="date-month">{item.kind}</div>
              </div>
              <div className="timeline-content">
                <div className="timeline-info"><h4>{item.title}</h4><p>Open study session</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column (only stats for now) */}
      <div className="two-column">
        <div className="card stats-card" ref={statsCardRef}>
          <div className="stats-header">
            <h3>Learning Stats</h3>
            <div className="stats-tabs">
              <div className="stats-tab active">Week</div>
              <div className="stats-tab">Month</div>
            </div>
          </div>
          <StudyChart days={chartDays} />
          <div style={{marginTop:20, textAlign:'center', color:'var(--color-text-mid)', fontSize:14}}>
            <p>Average study time: {fmtStudy(stats?.averages?.daily_study_seconds || 0)}/day</p>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="section quick-access" ref={quickAccessRef}>
        <div className="section-header">
          <h3 className="section-title">Quick Access</h3>
          <div className="section-action">View All</div>
        </div>
        <div className="access-cards">
          {quickSources.length === 0 ? (
            <div className="access-card">
              <div className="access-thumbnail"><i className="ri-time-line" /></div>
              <div className="access-content"><h4>No study time yet</h4><p>Your most practiced material will appear here.</p></div>
            </div>
          ) : quickSources.map((q) => (
            <div key={`${q.type}-${q.id}`} className="access-card" onClick={() => navigate(sessionUrl({ kind: q.type, id: q.id, title: q.title }))} style={{ cursor: 'pointer' }}>
              <div className="access-thumbnail"><i className={q.type === 'video' ? 'ri-video-line' : q.type === 'book' ? 'ri-book-line' : q.type === 'lecture' ? 'ri-mic-line' : 'ri-file-text-line'} /></div>
              <div className="access-content">
                <h4>{q.title}</h4>
                <p><i className="ri-time-line" /> {fmtStudy(q.seconds)} studied</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="gradient-bg" ref={achievementsRef}>
        <div className="section-header">
          <h3 className="section-title">Your Achievements</h3>
          <div className="section-action">View All</div>
        </div>
        <div className="achievements-wrap">
          {achievementsSeed.map(a => {
            const title = typeof a.title === 'function' ? a.title(streak) : a.title;
            return (
              <div key={title} className="achievement-card">
                <div className="achievement-icon" style={{ color: a.color }}><i className={a.icon} /></div>
                <h4>{title}</h4>
                <p>{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
