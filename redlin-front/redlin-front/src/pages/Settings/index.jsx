import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Alert,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import { settingsService } from '../../services/api/settings';

const LLM_PROVIDERS = [
  { value: 'gemini', label: 'Gemini', needsKey: true, allowsBaseUrl: false },
  { value: 'claude', label: 'Claude (Anthropic)', needsKey: true, allowsBaseUrl: false },
  { value: 'openai', label: 'OpenAI', needsKey: true, allowsBaseUrl: false },
  { value: 'ollama', label: 'Ollama (local)', needsKey: false, allowsBaseUrl: true, baseUrlPlaceholder: 'http://host.docker.internal:11434' },
  { value: 'nvidia_nim', label: 'Nvidia NIM', needsKey: true, allowsBaseUrl: true, baseUrlPlaceholder: 'https://integrate.api.nvidia.com/v1/' },
  { value: 'openrouter', label: 'OpenRouter', needsKey: true, allowsBaseUrl: true, baseUrlPlaceholder: 'https://openrouter.ai/api/v1/' },
];

export default function Settings() {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const providerMeta = LLM_PROVIDERS.find((p) => p.value === provider) || LLM_PROVIDERS[0];

  useEffect(() => {
    let active = true;
    settingsService
      .getLLMSettings()
      .then((data) => {
        if (!active) return;
        setProvider(data.provider || 'gemini');
        setModelName(data.model_name || '');
        setBaseUrl(data.base_url || '');
        setMaskedApiKey(data.masked_api_key || null);
        setConfigured(!!data.configured);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load your LLM settings. Is the backend running?');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const onProviderChange = (e) => {
    const next = e.target.value;
    setProvider(next);
    const meta = LLM_PROVIDERS.find((p) => p.value === next);
    // Prefill a sensible default base_url for OpenAI-compatible hosts.
    if (meta?.allowsBaseUrl && meta.baseUrlPlaceholder && !baseUrl) {
      setBaseUrl(meta.baseUrlPlaceholder);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      provider,
      model_name: modelName.trim(),
      base_url: baseUrl.trim(),
    };
    if (apiKey.trim()) {
      payload.api_key = apiKey.trim();
    }
    try {
      const data = await settingsService.saveLLMSettings(payload);
      setMaskedApiKey(data.masked_api_key || null);
      setConfigured(!!data.configured);
      setApiKey('');
      setSuccess('LLM settings saved. New content will use your provider.');
    } catch (err) {
      setError('Failed to save settings. Check the values and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '720px', mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        AI Provider Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connect your own LLM provider to generate summaries, MCQs, clozes and Feynman prompts with your key.
        When no key is configured, content is generated with Redlin's shared Gemini key.
      </Typography>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel id="llm-provider-label">Provider</InputLabel>
                <Select
                  labelId="llm-provider-label"
                  label="Provider"
                  value={provider}
                  onChange={onProviderChange}
                >
                  {LLM_PROVIDERS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {providerMeta.needsKey && (
                <TextField
                  label="API Key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configured && maskedApiKey ? maskedApiKey : 'Enter API key (stored encrypted)'}
                  helperText={
                    configured && maskedApiKey
                      ? 'A key is already configured. Leave blank to keep it.'
                      : 'Your key is encrypted at rest and never shown again.'
                  }
                  fullWidth
                />
              )}

              {providerMeta.allowsBaseUrl && (
                <TextField
                  label="Base URL"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={providerMeta.baseUrlPlaceholder}
                  fullWidth
                />
              )}

              <TextField
                label="Model name (optional)"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={provider === 'gemini' ? 'gemini-2.5-flash' : 'Your preferred model id'}
                fullWidth
              />

              {configured && !providerMeta.needsKey && (
                <Alert severity="info">
                  This provider runs locally or via a configured base URL — no API key required.
                </Alert>
              )}

              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}

              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="contained" disabled={saving}>
                  {saving ? 'Saving…' : 'Save settings'}
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
