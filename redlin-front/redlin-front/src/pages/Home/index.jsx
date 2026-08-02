import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHomeAnimations } from '../../hooks/useHomeAnimations';
import './Home.css';

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
  const streak = useDailyStreak(user?.id);

  const goalKey = useMemo(() => `goal:${user?.id}:today`, [user?.id]);
  const [done, setDone] = useState(0);
  const dailyGoal = 1;

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

  // Build calendar week (Mon-Sun) simple representation 1..7 with active today index
  const weekdays = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const todayIndex = ((new Date().getDay() + 6) % 7); // convert Sunday(0) -> 6

  const percent = Math.min(100, (done / dailyGoal) * 100);

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
            <h2>Bienvenido{user?.username ? ',' : ''} {user?.username || ''}</h2>
            <div className="streak">
              <i className="ri-fire-fill" />
              <span>Tu racha actual: {streak} {streak === 1 ? 'día' : 'días'}</span>
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
          <div className="progress-card-header"><h3>Progreso diario</h3></div>
          <div className="progress-card-content">
            <div className="calendar">
              {weekdays.map((d, idx) => {
                const dayNum = idx + 1;
                const active = idx === todayIndex;
                const completed = idx < todayIndex; // naive representation
                return (
                  <div key={d} className="calendar-day">
                    <div className="day-label">{d}</div>
                    <div className={`day-circle ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>{dayNum}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card progress-card">
          <div className="progress-card-header"><h3>Meta diaria</h3></div>
          <div className="progress-card-content">
            <div className="goal-progress">
              <div className="circular-progress" style={{ background: `conic-gradient(var(--color-teal) 0% ${percent}%, var(--color-cloud) ${percent}%, var(--color-cloud) 100%)` }}>
                <div className="progress-value">{done}/{dailyGoal}</div>
              </div>
              <div className="goal-text">{done >= dailyGoal ? 'Has completado tu meta diaria' : 'Progreso hacia tu meta'}</div>
              <div className="goal-label">{dailyGoal} pregunta{dailyGoal!==1?'s':''}</div>
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
          {upcomingSeed.map(item => (
            <div key={item.title} className="timeline-item">
              <div className="timeline-date">
                <div className="date-day">{item.day}</div>
                <div className="date-month">{item.month}</div>
              </div>
              <div className="timeline-content">
                <div className="timeline-info">
                  <h4>{item.title}</h4>
                  <p>{item.time}</p>
                </div>
                <div className="timeline-actions">
                  <button><i className="ri-notification-line" /></button>
                  <button><i className="ri-calendar-check-line" /></button>
                </div>
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
          <div className="stats-chart">
            {[40,65,85,55,70,30,20].map((h,i) => (
              <div key={i} className="chart-bar">
                <div className="bar" style={{ height: `${h}%` }} />
                <div className="bar-label">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:20, textAlign:'center', color:'var(--color-text-mid)', fontSize:14}}>
            <p>Average study time: 1.5 hours/day</p>
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
          {accessSeed.map(a => (
            <div key={a.title} className="access-card">
              <div className="access-thumbnail"><i className={a.icon} /></div>
              <div className="access-content">
                <h4>{a.title}</h4>
                <p><i className="ri-time-line" /> {a.info}</p>
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
