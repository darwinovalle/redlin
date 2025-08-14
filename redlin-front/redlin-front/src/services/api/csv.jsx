import api from './index.jsx';

export const csvService = {
  // Upload a CSV file (terms, definitions)
  uploadCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await api.post('/csv/imports/upload/', formData);
    return resp.data; // { import: {...}, created }
  },

  // List user CSV imports
  listImports: async () => {
    const resp = await api.get('/csv/imports/');
    return resp.data;
  },

  // List flashcards for this user (optionally by source import id)
  listFlashcards: async ({ sourceId, status } = {}) => {
    const params = new URLSearchParams();
    if (sourceId) params.set('source', sourceId);
    if (status) params.set('status', status);
    const qs = params.toString();
    const url = qs ? `/csv/flashcards/?${qs}` : '/csv/flashcards/';
    const resp = await api.get(url);
    return resp.data;
  },

  // Get prioritized study batch
  studyBatch: async ({ limit = 20, sourceId } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', limit);
    if (sourceId) params.set('source', sourceId);
    const resp = await api.get(`/csv/flashcards/study/?${params.toString()}`);
    return resp.data;
  },

  // Review a card
  reviewCard: async (id, quality) => {
    const resp = await api.post(`/csv/flashcards/${id}/review/`, { quality });
    return resp.data;
  },
};

export default csvService;
