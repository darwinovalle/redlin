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

  // POST /settings/llm/check/ -> live test-call against the provider to validate
  // the entered credentials/model before saving. Returns { ok, provider, model_name, preview }.
  checkLLMSettings: async (payload) => {
    const resp = await api.post('/settings/llm/check/', payload);
    return resp.data;
  },
};

export default settingsService;
