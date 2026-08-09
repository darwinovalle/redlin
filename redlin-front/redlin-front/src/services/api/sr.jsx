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

  // GET /api/reminders/due/ -> { count, items:[{content_type_id, object_id, method, question, status, interval_days}] }
  getDue: async () => {
    const resp = await api.get('/reminders/due/');
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