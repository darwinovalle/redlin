import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_URL,
  // Remove the default Content-Type header
  // headers: {
  //   'Content-Type': 'application/json',
  // }
});

// Attach token automatically
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('auth');
    if (stored) {
      const { access } = JSON.parse(stored);
      if (access) config.headers.Authorization = `Bearer ${access}`;
    }
  } catch {}
  return config;
});

// On 401, try refresh once
let isRefreshing = false;
let pending = [];

function onRefreshed(token) { pending.forEach(cb => cb(token)); pending = []; }

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve) => {
          pending.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const stored = JSON.parse(localStorage.getItem('auth') || '{}');
        const resp = await axios.post(`${API_URL}/auth/refresh/`, { refresh: stored.refresh });
        const { access, refresh } = resp.data || {};
        const updated = { ...(stored || {}), access, refresh };
        localStorage.setItem('auth', JSON.stringify(updated));
        isRefreshing = false; onRefreshed(access);
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch (e) {
        isRefreshing = false; pending = [];
        try { localStorage.removeItem('auth'); } catch {}
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login/', {
        username,
        password
      });
      return response.data;
    } catch (error) {
      throw error.response.data;
      console.log('error', error) 
    }
  },

  register: async (username, email, password) => {
    try {
      const response = await api.post('/auth/register/', {
        username,
        email,
        password
      });
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }
};

export const documentService = {
  uploadDocument: async (file, userId) => {
    const formData = new FormData();
    formData.append('pdf_file', file);
    formData.append('title', file.name); // Use filename as title
    formData.append('user', userId);

    try {
      // Use the 'api' axios instance. Axios sets Content-Type for FormData automatically.
      // If issues arise, uncomment and adjust the header below.
      const response = await api.post('/documents/', formData /*, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }*/);
      return response.data;
    } catch (error) {
      console.error('Document upload error:', error.response || error);
      throw error.response?.data || { error: 'Document upload failed' };
    }
  },
  
  // Rename a document's title
  renameDocument: async (documentId, newTitle) => {
    try {
      const response = await api.patch(`/documents/${documentId}/`, { title: newTitle });
      return response.data;
    } catch (error) {
      console.error('Error renaming document:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to rename document' };
    }
  },

  async getSummaryForDocument(documentId) {
    if (!documentId) {
      return null;
    }
    try {
      // Prefer the document action endpoint that returns the linked summary
      const response = await api.get(`/documents/${documentId}/summary/`);
      return response.data; // { id, content, document }
    } catch (error) {
      console.error(`Error fetching summary for document ${documentId}:`, error.response?.data || error.message);
      throw {
        message: 'Failed to fetch summary',
        status: error.response?.status,
        details: error.response?.data,
      };
    }
  },

  async getUserDocuments(userId) {
    try {
      // Try accessing the endpoint that was previously working
      // This matches the original implementation before our changes
      const response = await api.get(`/documents/user/${userId}/`);
      return response.data || []; // Ensure we always return an array
    } catch (error) {
      console.error('Error fetching user documents:', error.response?.data || error.message);
      // Return empty array rather than throwing to prevent UI errors
      return [];
    }
  },

  async getFlashcardsForDocument(documentId) {
    if (!documentId) {
      return []; // Return empty array if no document ID is provided
    }
    try {
      // Assumes endpoint is /api/documents/{documentId}/flashcards/
      const response = await api.get(`/documents/${documentId}/flashcards/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching flashcards for document ${documentId}:`, error.response?.data || error.message);
      throw { 
        message: 'Failed to fetch flashcards', 
        status: error.response?.status, 
        details: error.response?.data 
      };
    }
  },

  // Update a flashcard (keyword and definition)
  async updateFlashcard(id, { key_term, definition }) {
    try {
      const resp = await api.patch(`/flashcards/${id}/`, { key_term, definition });
      return resp.data;
    } catch (error) {
      console.error('Error updating flashcard:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to update flashcard' };
    }
  },

  // Delete a flashcard
  async deleteFlashcard(id) {
    try {
      await api.delete(`/flashcards/${id}/`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting flashcard:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to delete flashcard' };
    }
  },

  // Study batch (prioritized) for document flashcards
  async studyBatch({ limit = 20, documentId } = {}) {
    const params = new URLSearchParams();
    params.set('limit', limit);
    if (documentId) params.set('document', documentId);
    try {
      const resp = await api.get(`/flashcards/study/?${params.toString()}`);
      return resp.data;
    } catch (error) {
      console.error('Error fetching study batch:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to fetch study batch' };
    }
  },

  // Review a card (SM-2)
  async reviewCard(id, quality) {
    try {
      const resp = await api.post(`/flashcards/${id}/review/`, { quality });
      return resp.data;
    } catch (error) {
      console.error('Error reviewing flashcard:', error.response?.data || error.message);
      throw error.response?.data || { error: 'Failed to review flashcard' };
    }
  },

  // Function to get quiz data (MCQs) for a specific document
  async getQuizForDocument(documentId) {
    if (!documentId) {
      return []; // Return empty array if no document ID
    }
    try {
      const response = await api.get(`/documents/${documentId}/mcqs/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching quiz data for document ${documentId}:`, error.response?.data || error.message);
      throw { 
        message: 'Failed to fetch quiz data', 
        status: error.response?.status, 
        details: error.response?.data 
      };
    }
  },

  deleteDocument: async (documentId) => {
    try {
      // Keep it simple and similar to getUserDocuments
      const response = await api.delete(`/documents/${documentId}/`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || 'Failed to delete document' };
    }
  }
};

export default api;