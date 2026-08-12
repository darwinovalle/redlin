import api from './index.jsx';

// Helper to extract a plausible YouTube video id from a URL (frontend validation only)
function extractVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      // Shorts format /shorts/{id}
      const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
      if (shortsMatch) return shortsMatch[1];
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return id;
    }
  } catch {}
  // Basic fallback regex
  const m = url.match(/(?:v=|youtu.be\/|shorts\/)([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// Resolve a media path (e.g. "/media/video_files/x.mp4") to an absolute URL
// against the API origin. Media is served by the backend, not the Vite dev
// server, so a bare relative path would resolve to the wrong origin.
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) {
    const origin = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    return `${origin}${path}`;
  }
  return path;
}

export const videoService = {
  createVideo: async ({ url, languages } = {}) => {
    if (!url) throw new Error('URL is required');
    const resp = await api.post('/video/videos/', { url, languages });
    return resp.data; // returns video object
  },

  // Upload an MP4 file — the backend transcribes it with Whisper and generates
  // the same summary/MCQs/clozes/Feynman content as YouTube videos.
  uploadVideo: async (file) => {
    if (!file) throw new Error('A video file is required');
    const form = new FormData();
    form.append('video_file', file);
    const resp = await api.post('/video/videos/', form);
    return resp.data;
  },

  listVideos: async () => {
    const resp = await api.get('/video/videos/');
    return Array.isArray(resp.data) ? resp.data : [];
  },

  getVideo: async (id) => {
    if (!id) throw new Error('id required');
    const resp = await api.get(`/video/videos/${id}/`);
    return resp.data;
  },

  renameVideo: async (id, title) => {
    if (!id) throw new Error('id required');
    if (!title || !title.trim()) throw new Error('title required');
    const resp = await api.patch(`/video/videos/${id}/`, { title: title.trim() });
    return resp.data;
  },

  deleteVideo: async (id) => {
    if (!id) throw new Error('id required');
    const resp = await api.delete(`/video/videos/${id}/`);
    return resp.data;
  },

  getVideoSummary: async (id) => {
    const resp = await api.get(`/video/videos/${id}/summary/`);
    return resp.data; // { id, video, content }
  },

  getVideoMCQs: async (id) => {
    const resp = await api.get(`/video/videos/${id}/mcqs/`);
    return Array.isArray(resp.data) ? resp.data : [];
  },

  getFullDetails: async (id) => {
    const resp = await api.get(`/video/videos/${id}/full_details/`);
    return resp.data; // { video: {...}, summary: {...} | null, mcqs: [] }
  },

  reprocessVideo: async (id, { languages } = {}) => {
    const resp = await api.post(`/video/videos/${id}/reprocess/`, { languages });
    return resp.data;
  },

  extractVideoId,
  embedUrl: (video) => {
    const id = typeof video === 'string' ? video : (video?.video_id || extractVideoId(video?.url));
    return id ? `https://www.youtube.com/embed/${id}` : null;
  },
  mediaUrl
};

export default videoService;
