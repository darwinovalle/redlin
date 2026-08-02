import api from './index.jsx';

export const classroomService = {
  async createSession({ title, language = 'es' } = {}) {
    if (!title) throw new Error('title is required');
    const response = await api.post('/classroom/sessions/start/', { title, language });
    return response.data;
  },

  async listSessions() {
    const response = await api.get('/classroom/sessions/');
    return Array.isArray(response.data) ? response.data : [];
  },

  async stopSession(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.post(`/classroom/sessions/${sessionId}/stop/`);
    return response.data;
  },

  async getSessionStatus(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.get(`/classroom/sessions/${sessionId}/status/`);
    return response.data;
  },

  async uploadAudio(sessionId, audioFile) {
    if (!sessionId) throw new Error('sessionId is required');
    if (!audioFile) throw new Error('audioFile is required');

    const formData = new FormData();
    formData.append('audio_file', audioFile, audioFile.name || 'classroom-recording.webm');

    const response = await api.post(`/classroom/sessions/${sessionId}/upload-audio/`, formData);
    return response.data;
  },

  async finishSession(sessionId, transcriptText = '') {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.post(`/classroom/sessions/${sessionId}/finish/`, {
      transcript_text: transcriptText,
    });
    return response.data;
  },

  async getResults(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.get(`/classroom/sessions/${sessionId}/results/`);
    return response.data;
  },

  async renameSession(sessionId, title) {
    if (!sessionId) throw new Error('sessionId is required');
    if (!title || !title.trim()) throw new Error('title is required');
    const response = await api.patch(`/classroom/sessions/${sessionId}/`, { title: title.trim() });
    return response.data;
  },

  async deleteSession(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.delete(`/classroom/sessions/${sessionId}/`);
    return response.data;
  },

  async getFeynmanPrompts(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.get(`/classroom/sessions/${sessionId}/feynman/prompts/`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getFeynmanHistory(sessionId) {
    if (!sessionId) throw new Error('sessionId is required');
    const response = await api.get(`/classroom/sessions/${sessionId}/feynman/history/`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async evaluateFeynman({ sessionId, feynmanId, answer }) {
    if (!sessionId) throw new Error('sessionId is required');
    if (!feynmanId) throw new Error('feynmanId is required');
    const response = await api.post(`/classroom/sessions/${sessionId}/feynman/evaluate/`, {
      feynman_id: feynmanId,
      answer,
    });
    return response.data;
  },
};

export default classroomService;