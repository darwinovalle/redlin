import api from './index.jsx';

// Service for Cloze retrieval & validation across Documents and Videos
export const clozeService = {
  // List clozes for a document
  async listDocumentClozes(documentId) {
    if (!documentId) throw new Error('documentId required');
    try {
      const resp = await api.get(`/documents/${documentId}/clozes/`);
      const data = resp.data;
      // Some endpoints might wrap in pagination; normalize to array
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    } catch (error) {
      console.error('Error listing document clozes:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to list document clozes' };
    }
  },

  // List clozes for a video
  async listVideoClozes(videoId) {
    if (!videoId) throw new Error('videoId required');
    try {
      const resp = await api.get(`/video/videos/${videoId}/clozes/`);
      const data = resp.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    } catch (error) {
      console.error('Error listing video clozes:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to list video clozes' };
    }
  },

  // Validate a cloze answer. type = 'document' | 'video'
  async validate({ clozeId, answer, type }) {
    if (!clozeId) throw new Error('clozeId required');
    if (!type) throw new Error('type required');
    try {
      const payload = { cloze_id: clozeId, answer, cloze_type: type };
      const resp = await api.post('/cloze/validate/', payload);
      return resp.data; // { cloze_id, correct, type }
    } catch (error) {
      console.error('Error validating cloze:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to validate cloze' };
    }
  }
};

export default clozeService;