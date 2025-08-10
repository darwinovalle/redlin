import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_URL,
  // Remove the default Content-Type header
  // headers: {
  //   'Content-Type': 'application/json',
  // }
});

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

export default authService;