import api from './index.jsx';

export const settingsService = {
  // GET /settings/llm/ -> { provider, base_url, model_name, masked_api_key, configured }
  getLLMSettings: async () => {
    const resp = await api.get('/settings/llm/');
    return resp.data;
  },

  // PUT /settings/llm/ -> save provider config (api_key is optional; blank clears it)
  saveLLMSettings: async (payload) => {
    const resp = await api.put('/settings/llm/', payload);
    return resp.data;
  },
};

export default settingsService;
