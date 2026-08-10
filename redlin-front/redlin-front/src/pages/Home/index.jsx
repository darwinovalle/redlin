import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { srService } from '../../services/api/sr';
import { documentService } from '../../services/api';
import { videoService } from '../../services/api/video';
import { classroomService } from '../../services/api/classroom';
import { topicsService } from '../../services/api/topics';
import NotificationBell from '../../components/common/NotificationBell';
import StudyTimeChart from '../../components/common/StudyTimeChart';
import ReviewCalendar from '../../components/common/ReviewCalendar';
import { lastWeekDays, monthWeekBuckets } from '../../utils/studyDays';
import './Home.css';

const fmtStudy = (s) => {
  const m = Math.round((s || 0) / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

const kindIcon = (k) => (k === 'video' ? 'ri-video-line' : k === 'book' ? 'ri-book-line' : k === 'lecture' ? 'ri-mic-line' : 'ri-file-text-line');

// Cache of auth-fetched cover object URLs (like Books' PdfCover).
const docCoverCache = new Map();

// Renders the real cover/thumbnail: document & book covers are served by the
// backend behind auth (/documents/{id}/cover/), so fetch them with the token
// (same as Books' PdfCover); videos/lectures use their plain public URLs.
const SmartThumb = ({ src, kind, alt }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | err
  useEffect(() => {
    if (!src) { setState('err'); return undefined; }
    setState('loading'); setImgSrc(null);
    if (!String(src).includes('/cover/')) { setImgSrc(src); setState('ready'); return undefined; }
    const hit = docCoverCache.get(src);
    if (hit !== undefined) { setImgSrc(hit); setState('ready'); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const accessR = (() => { try { return JSON.parse(localStorage.getItem('auth') || '{}').access; } catch { return null; } })();
        const res = await fetch(src, { headers: accessR ? { Authorization: `Bearer ${accessR}` } : {} });
        if (!res.ok) throw new Error('cover fetch failed');
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        docCoverCache.set(src, obj);
        if (!cancelled) { setImgSrc(obj); setState('ready'); }
      } catch { if (!cancelled) setState('err'); }
    })();
    return () => { cancelled = true; };
  }, [src]);

  if (state === 'ready' && imgSrc) {
    return <img src={imgSrc} alt={alt || ''} loading="lazy" onError={() => setState('err')} />;
  }
  return <div className="thumb-fallback"><i className={kindIcon(kind)} /></div>;
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
  const [journey, setJourney] = useState([]);
  // Some list services return DRF-paginated {results:[...]}; unwrap to a plain array.
  const unwrap = (d) => (Array.isArray(d) ? d : (d?.results || []));
  const streak = stats?.streak?.current || 0;
  const dailyGoal = 1;

  // Map kanban subjects to journey milestones (pending / current / completed).
  const mapJourney = (topics) => (Array.isArray(topics) ? topics : []).map((t) => {
    const cols = t?.board?.columns || [];
    const total = cols.reduce((n, c) => n + (c.cards || []).length, 0);
    const mastered = cols.length ? (cols[cols.length - 1].cards || []).length : 0;
    let status = 'pending';
    if (total > 0) {
      if (mastered === total) status = 'completed';
      else if (cols.slice(0, Math.max(1, cols.length - 1)).some((c) => (c.cards || []).length > 0)) status = 'current';
    }
    return { id: t.id, title: t.name, total, mastered, status };
  });

  // Load the user's real study resources for "Upcoming Sessions".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = [];
      try { const d = await documentService.getUserDocuments(user?.id); out.push(...unwrap(d).map((x) => ({ kind: 'document', id: x.id, title: x.title, thumb: documentService.getBookCoverUrl(x.id) }))); } catch {}
      try { const b = await documentService.listBooks(); out.push(...unwrap(b).map((x) => ({ kind: 'book', id: x.id, title: x.title, thumb: documentService.getBookCoverUrl(x.id) }))); } catch {}
      try { const v = await videoService.listVideos(); out.push(...unwrap(v).map((x) => ({ kind: 'video', id: x.id, title: x.title || x.video_id || 'Video', thumb: x.video_id ? `https://img.youtube.com/vi/${x.video_id}/hqdefault.jpg` : '' }))); } catch {}
      try { const l = await classroomService.listSessions(); out.push(...unwrap(l).map((x) => ({ kind: 'lecture', id: x.id, title: x.title, thumb: x.cover_image_url || '' }))); } catch {}
      if (!cancelled) setSessions(out.slice(0, 20));
      if (!cancelled) setSessions(out.slice(0, 6));
      try { const tp = await topicsService.listTopics(); if (!cancelled) setJourney(mapJourney(tp)); } catch {}
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
  // Straight source->thumbnail, no cross-matching: the backend sends video_id /
  // cover_image_url per source; documents/books use the PDF-cover endpoint.
  const quickThumb = (q) => {
    if (q.type === 'video') return q.video_id ? `https://img.youtube.com/vi/${q.video_id}/hqdefault.jpg` : '';
    if (q.type === 'lecture') return q.cover_image_url || '';
    return documentService.getBookCoverUrl(q.id);
  };
  const thumbOf = useMemo(() => {
    const m = {};
    for (const s of sessions) m[`${s.kind}:${s.id}`] = s.thumb;
    return m;
  }, [sessions]);
  const [chartRange, setChartRange] = useState('week'); // 'week' | 'month'
  const chartDays = useMemo(
    () => (chartRange === 'month'
      ? monthWeekBuckets(stats?.study?.per_day)
      : lastWeekDays(stats?.study?.per_day, 7)),
    [stats, chartRange]
  );

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
      {/* Header — unified welcome hero */}
      <div className="header" ref={welcomeRef}>
        <div className="welcome">
          <div className="user-avatar">{(user?.username || '?').charAt(0).toUpperCase()}</div>
          <div className="welcome-text">
            <h2>Welcome back{user?.username ? `, ${user.username}` : ''}</h2>
            <p>Your brain&apos;s in gear — keep the study flow going.</p>
            <div className="streak">
              <i className="ri-fire-fill" />
              <span>{streak} {streak === 1 ? 'day' : 'days'} current streak</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <NotificationBell tone="light" />
          <ReviewCalendar />
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
                    <div className={`day-circle ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>{fire ? <i className="ri-fire-fill" style={{ color: 'var(--color-purple)', fontStyle: 'normal', fontSize: 22 }} /> : dayNum}</div>
                  </div>
                );
              })}
            </div>
            <div className="calendar-note">Keep the good work going!</div>
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
              <div className="timeline-date"><SmartThumb src={item.thumb} kind={item.kind} alt={item.title} /></div>
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
              <div className={`stats-tab ${chartRange === 'week' ? 'active' : ''}`} onClick={() => setChartRange('week')}>Week</div>
              <div className={`stats-tab ${chartRange === 'month' ? 'active' : ''}`} onClick={() => setChartRange('month')}>Month</div>
            </div>
          </div>
          <StudyTimeChart days={chartDays} />
          <div style={{marginTop:20, textAlign:'center', color:'var(--color-text-mid)', fontSize:14}}>
            <p>Average study time: {fmtStudy(stats?.averages?.daily_study_seconds || 0)}/day</p>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="section quick-access" ref={quickAccessRef}>
        <div className="section-header">
          <h3 className="section-title">Quick Access</h3>
        </div>
        <div className="access-cards">
          {quickSources.length === 0 ? (
            <div className="access-card">
              <div className="access-thumbnail"><i className="ri-time-line" /></div>
              <div className="access-content"><h4>No study time yet</h4><p>Your most practiced material will appear here.</p></div>
            </div>
          ) : quickSources.map((q) => (
            <div key={`${q.type}-${q.id}`} className="access-card" onClick={() => navigate(sessionUrl({ kind: q.type, id: q.id, title: q.title }))} style={{ cursor: 'pointer' }}>
              <div className="access-thumbnail"><SmartThumb src={quickThumb(q)} kind={q.type} alt={q.title} /></div>
              <div className="access-content">
                <h4>{q.title}</h4>
                <p><i className="ri-time-line" /> {fmtStudy(q.seconds)} studied</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      </div>
  );
};

export default Home;
