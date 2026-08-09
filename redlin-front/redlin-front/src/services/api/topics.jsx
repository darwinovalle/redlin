import api from './index.jsx';

// Client for the Subjects/Kanban (Topic/Board/Column/Card/CardResource) API.
// Endpoints live under /api/ (CORE.urls): /topics/, /columns/, /cards/, /card-resources/.
export const topicsService = {
  // ---- Subjects (Topics) ----
  listTopics: async () => {
    const resp = await api.get('/topics/');
    return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
  },

  getTopic: async (id) => {
    const resp = await api.get(`/topics/${id}/`);
    return resp.data; // includes nested board -> columns -> cards
  },

  createTopic: async (payload) => {
    const resp = await api.post('/topics/', payload || {});
    return resp.data;
  },

  updateTopic: async (id, payload) => {
    const resp = await api.patch(`/topics/${id}/`, payload || {});
    return resp.data;
  },

  deleteTopic: async (id) => {
    const resp = await api.delete(`/topics/${id}/`);
    return resp.data;
  },

  // ---- Columns ----
  createColumn: async (payload) => {
    const resp = await api.post('/columns/', payload || {});
    return resp.data;
  },

  updateColumn: async (id, payload) => {
    const resp = await api.patch(`/columns/${id}/`, payload || {});
    return resp.data;
  },

  deleteColumn: async (id) => {
    const resp = await api.delete(`/columns/${id}/`);
    return resp.data;
  },

  // ---- Cards (tickets) ----
  createCard: async (payload) => {
    const resp = await api.post('/cards/', payload || {});
    return resp.data;
  },

  // Move = PATCH { column, position }; rename/edit = PATCH { title, notes, priority, ... }.
  updateCard: async (id, payload) => {
    const resp = await api.patch(`/cards/${id}/`, payload || {});
    return resp.data;
  },

  deleteCard: async (id) => {
    const resp = await api.delete(`/cards/${id}/`);
    return resp.data;
  },

  // ---- CardResources (attach existing study material to a card) ----
  addResource: async (cardId, resourceType, resourceId) => {
    const resp = await api.post('/card-resources/', { card: cardId, resource_type: resourceType, resource_id: resourceId });
    return resp.data;
  },

  removeResource: async (id) => {
    const resp = await api.delete(`/card-resources/${id}/`);
    return resp.data;
  },

  listResources: async (cardId) => {
    const resp = await api.get('/card-resources/', { params: { card: cardId } });
    return Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
  },
};

export default topicsService;