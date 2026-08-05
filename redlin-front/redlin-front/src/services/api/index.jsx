const API_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api';
function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem('auth') || '{}');
  } catch {
    return {};
  }
}

function setStoredAuth(data) {
  try {
    localStorage.setItem('auth', JSON.stringify(data));
  } catch {}
}

function clearStoredAuth() {
  try {
    localStorage.removeItem('auth');
  } catch {}
}

function buildApiUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

async function parseResponseBody(response) {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
}

function createHttpError(data, status, config, url) {
  const message =
    (typeof data === 'string' && data) ||
    data?.detail ||
    data?.message ||
    `Request failed with status ${status}`;
  const error = new Error(message);
  error.response = { status, data, url };
  error.status = status;
  error.config = config;
  return error;
}

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isBinaryPayload(value) {
  return (
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value))
  );
}

function prepareRequestBody(data, headers) {
  if (data === undefined || data === null) {
    return undefined;
  }
  if (isFormData(data) || data instanceof URLSearchParams || isBinaryPayload(data) || typeof data === 'string') {
    return data;
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return JSON.stringify(data);
}

let isRefreshing = false;
let pendingRefreshSubscribers = [];

function enqueueRefreshSubscriber() {
  return new Promise((resolve, reject) => {
    pendingRefreshSubscribers.push({ resolve, reject });
  });
}

function resolveRefreshSubscribers(token) {
  pendingRefreshSubscribers.forEach(({ resolve }) => resolve(token));
  pendingRefreshSubscribers = [];
}

function rejectRefreshSubscribers(error) {
  pendingRefreshSubscribers.forEach(({ reject }) => reject(error));
  pendingRefreshSubscribers = [];
}

async function refreshAccessToken() {
  if (isRefreshing) {
    return enqueueRefreshSubscriber();
  }

  isRefreshing = true;
  try {
    const stored = getStoredAuth();
    if (!stored?.refresh) {
      throw createHttpError(
        { detail: 'Missing refresh token' },
        401,
        { method: 'POST', url: '/auth/refresh/' },
        buildApiUrl('/auth/refresh/')
      );
    }

    const response = await fetch(buildApiUrl('/auth/refresh/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh: stored.refresh })
    });

    const data = await parseResponseBody(response);
    if (!response.ok) {
      throw createHttpError(data, response.status, { method: 'POST', url: '/auth/refresh/' }, buildApiUrl('/auth/refresh/'));
    }

    const updated = {
      ...stored,
      access: data?.access,
      refresh: data?.refresh || stored.refresh
    };
    setStoredAuth(updated);
    resolveRefreshSubscribers(updated.access);
    return updated.access;
  } catch (error) {
    clearStoredAuth();
    rejectRefreshSubscribers(error);
    throw error;
  } finally {
    isRefreshing = false;
  }
}

async function request(method, url, data, config = {}, canRefresh = true) {
  const normalizedMethod = method.toUpperCase();
  const fullUrl = buildApiUrl(url);
  const headers = new Headers(config.headers || {});
  const stored = getStoredAuth();

  if (stored?.access && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${stored.access}`);
  }

  const shouldSendBody = normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
  const body = shouldSendBody ? prepareRequestBody(data, headers) : undefined;

  let response;
  try {
    response = await fetch(fullUrl, {
      method: normalizedMethod,
      headers,
      body,
      signal: config.signal
    });
  } catch (networkError) {
    const error = new Error(networkError?.message || 'Network request failed');
    error.cause = networkError;
    throw error;
  }

  const responseData = await parseResponseBody(response);

  if (response.ok) {
    return {
      data: responseData,
      status: response.status,
      headers: response.headers,
      url: fullUrl,
      config
    };
  }

  const requestConfig = { method: normalizedMethod, url, data, headers: config.headers };
  if (response.status === 401 && canRefresh && !config.skipAuthRefresh && !url.includes('/auth/refresh/')) {
    await refreshAccessToken();
    return request(method, url, data, config, false);
  }

  throw createHttpError(responseData, response.status, requestConfig, fullUrl);
}

const api = {
  baseURL: API_URL,
  request: ({ method = 'GET', url, data, ...config } = {}) => {
    if (!url) {
      throw new Error('url is required');
    }
    return request(method, url, data, config);
  },
  get: (url, config) => request('GET', url, undefined, config),
  post: (url, data, config) => request('POST', url, data, config),
  put: (url, data, config) => request('PUT', url, data, config),
  patch: (url, data, config) => request('PATCH', url, data, config),
  delete: (url, config) => request('DELETE', url, undefined, config)
};

export const authService = {
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login/', {
        username,
        password
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Login failed' };
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
      throw error.response?.data || { error: 'Registration failed' };
    }
  }
};

export const documentService = {
  getPdfUrl: (documentId) => `${API_URL}/documents/${documentId}/file/`,
  getBookCoverUrl: (documentId) => `${API_URL}/documents/${documentId}/cover/`,
  getHighlights: (documentId) => api.get(`/documents/${documentId}/highlights/`).then((r) => r.data),
  listBooks: () => api.get('/documents/books/').then((r) => r.data),
  getBookChapters: (bookId) => api.get(`/documents/${bookId}/chapters/`).then((r) => r.data),
  addBookChapters: (bookId, chapters) => api.post(`/documents/${bookId}/chapters/`, { chapters }).then((r) => r.data),
  createBook: ({ title, file, chapters, totalPages }) => {
    const formData = new FormData();
    formData.append('pdf_file', file);
    formData.append('title', title);
    formData.append('chapters_json', JSON.stringify(chapters));
    if (totalPages) formData.append('total_pages', String(totalPages));
    return api.post('/documents/books/', formData).then((r) => r.data);
  },
  createHighlight: (documentId, data) => api.post(`/documents/${documentId}/highlights/`, data).then((r) => r.data),
  deleteHighlight: (documentId, highlightId) => api.delete(`/documents/${documentId}/highlights/${highlightId}/`).then(() => {}),
  uploadDocument: async (file, userId, title) => {
    const formData = new FormData();
    formData.append('pdf_file', file);
    formData.append('title', (title || '').trim() || file.name); // custom title, else filename
    formData.append('user', userId);

    try {
      // Do not set Content-Type manually for FormData; the browser will include boundaries.
      const response = await api.post('/documents/', formData);
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