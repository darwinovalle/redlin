import api from './index.jsx';

// Study analytics + spaced-repetition client (Stats/SR engine).
export const srService = {
  // GET /api/stats/ -> { streak, xp, overall, methods, study, due }
  getStats: async () => {
    const resp = await api.get('/stats/');
    return resp.data;
  },

  // POST /api/study/ { seconds, topic?, card?, method?, object_id? }
  recordStudy: async (payload) => {
    const resp = await api.post('/study/', payload || {});
    return resp.data;
  },

  // POST /api/attempts/ { content_type_id, object_id, method, correct, latency_ms, ... }
  submitAttempt: async (payload) => {
    const resp = await api.post('/attempts/', payload || {});
    return resp.data;
  },

  // GET /api/reminders/due/ -> { count, groups:[{source, source_id, title, subtitle, items:[{progress_id, content_type_id, object_id, method, question, status, interval_days, due_at, detail}]}] }
  // Items are grouped by study source (video / document / book-chapter / lecture)
  // and each carries a full graded `detail` payload for the review quiz.
  getDue: async () => {
    const resp = await api.get('/reminders/due/');
    return resp.data;
  },

  // POST /api/review/feynman-evaluate/ { content_type_id, object_id, answer }
  // -> { score, passed, feedback, breakdown } — grades a Feynman prompt during
  // an active-recall review session and records its SM-2 schedule.
  evaluateReviewFeynman: async (payload) => {
    const resp = await api.post('/review/feynman-evaluate/', payload || {});
    return resp.data;
  },

  // GET /api/reminders/calendar/ -> { days:[{date,count}], upcoming:[{date,method,question,interval_days}] }
  getReviewCalendar: async () => {
    const resp = await api.get('/reminders/calendar/');
    return resp.data;
  },

  // GET /api/reminders/ -> { count, unread, items } (the notification bell)
  getReminders: async () => {
    const resp = await api.get('/reminders/');
    return resp.data;
  },

  // POST /api/reminders/{id}/read/ -> mark a reminder as read
  markReminderRead: async (id) => {
    const resp = await api.post(`/reminders/${id}/read/`);
    return resp.data;
  },

  // POST /api/study/feynman/ { model, seconds, average, scores:[{item_id, score}] }
  saveFeynmanSession: async (payload) => {
    const resp = await api.post('/study/feynman/', payload || {});
    return resp.data;
  },
};

export default srService;