import api from './index.jsx';

// Feynman API client for documents & videos
export const feynmanService = {
  async listDocumentPrompts(documentId) {
    if (!documentId) return [];
    const resp = await api.get(`/documents/${documentId}/feynman/prompts/`);
    return resp.data;
  },
  async listDocumentHistory(documentId) {
    if (!documentId) return [];
    const resp = await api.get(`/documents/${documentId}/feynman/history/`);
    return resp.data;
  },
  async evaluateDocument({ documentId, feynmanId, answer }) {
    if (!documentId) throw new Error('documentId required');
    const resp = await api.post(`/documents/${documentId}/feynman/evaluate/`, { feynman_id: feynmanId, answer });
    return resp.data;
  },
  async listVideoPrompts(videoId) {
    if (!videoId) return [];
    const resp = await api.get(`/video/videos/${videoId}/feynman/prompts/`);
    return resp.data;
  },
  async listVideoHistory(videoId) {
    if (!videoId) return [];
    const resp = await api.get(`/video/videos/${videoId}/feynman/history/`);
    return resp.data;
  },
  async evaluateVideo({ videoId, feynmanId, answer }) {
    if (!videoId) throw new Error('videoId required');
    const resp = await api.post(`/video/videos/${videoId}/feynman/evaluate/`, { feynman_id: feynmanId, answer });
    return resp.data;
  }
};
