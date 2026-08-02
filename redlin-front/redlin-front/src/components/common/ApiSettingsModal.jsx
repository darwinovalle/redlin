import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  IconButton,
  Box,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import { settingsService } from '../../services/api/settings';

const LLM_PROVIDERS = [
  { value: 'gemini', label: 'Gemini', needsKey: true, allowsBaseUrl: false },
  { value: 'claude', label: 'Claude (Anthropic)', needsKey: true, allowsBaseUrl: false },
  { value: 'openai', label: 'OpenAI', needsKey: true, allowsBaseUrl: false },
  { value: 'ollama', label: 'Ollama (local)', needsKey: false, allowsBaseUrl: true, baseUrlPlaceholder: 'http://host.docker.internal:11434' },
  { value: 'nvidia_nim', label: 'Nvidia NIM', needsKey: true, allowsBaseUrl: true, baseUrlPlaceholder: 'https://integrate.api.nvidia.com/v1/' },
  { value: 'openrouter', label: 'OpenRouter', needsKey: true, allowsBaseUrl: true, baseUrlPlaceholder: 'https://openrouter.ai/api/v1/' },
];

/* ------------------------------------------------------------------ */
/*  Reusable styled input to match the dark-shell AddSpaceModal look   */
/* ------------------------------------------------------------------ */
const FieldInput = ({ label, value, onChange, placeholder, type, helper, disabled, region }) => (
  <Box sx={{ mb: 2.5 }}>
    <Typography
      component="label"
      sx={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', mb: 0.75, letterSpacing: '0.01em' }}
    >
      {label}
    </Typography>
    <Box
      component={region === 'select' ? 'select' : 'input'}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      sx={{
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)',
        color: '#E0E0E0',
        fontSize: 14,
        px: 1.75,
        py: 1.25,
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, background 0.2s',
        '&:focus': {
          borderColor: 'rgba(32,201,151,0.55)',
          background: 'rgba(32,201,151,0.06)',
        },
        '&::placeholder': { color: 'rgba(255,255,255,0.3)' },
      }}
    >
      {region === 'select'
        ? LLM_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))
        : null}
    </Box>
    {helper && (
      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        {helper}
      </Typography>
    )}
  </Box>
);

export default function ApiSettingsModal({ open, onClose }) {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const providerMeta = LLM_PROVIDERS.find((p) => p.value === provider) || LLM_PROVIDERS[0];
  const apiKeyRef = useRef(null);

  /* ------- load current settings on open ------- */
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    setSuccessMsg('');
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
      .catch((err) => {
        if (!active) return;
        setError(err?.display || err?.message || 'Could not load settings. Is the backend running?');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  /* ------- save ------- */
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = { provider, model_name: modelName };
      if (providerMeta.needsKey) payload.api_key = apiKey;
      if (providerMeta.allowsBaseUrl) payload.base_url = baseUrl;
      await settingsService.saveLLMSettings(payload);
      setSuccessMsg('Provider settings saved.');
      setConfigured(true);
    } catch (err) {
      setError(err?.settings || err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  /* Reset key field when provider changes */
  const handleProviderChange = (e) => {
    setProvider(e.target.value);
    setApiKey('');
  };

  /* ------------------------------------------------------------------ */
  /*                          RENDER                                     */
  /* ------------------------------------------------------------------ */
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        style: { backgroundColor: '#1A2A3A' },
        sx: {
          width: { xs: '92vw', sm: 520 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        },
      }}
    >
      {/* ── Header bar ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2.25,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SettingsIcon sx={{ color: '#20C997', fontSize: 22 }} />
          <Typography sx={{ color: 'white', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
            API Settings
          </Typography>
          {configured && (
            <Box
              sx={{
                ml: 1,
                px: 1,
                py: '2px',
                borderRadius: '999px',
                background: 'rgba(32,201,151,0.15)',
                color: '#20C997',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              CONFIGURED
            </Box>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#20C997' }} />
          </Box>
        ) : (
          <Box component="form" noValidate autoComplete="off">
            {/* Provider selector */}
            <FieldInput
              label="Provider"
              value={provider}
              onChange={handleProviderChange}
              region="select"
            />

            {/* API Key — only for providers that need one */}
            {providerMeta.needsKey && (
              <Box sx={{ mb: 2.5 }}>
                <Typography
                  component="label"
                  sx={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.78)', mb: 0.75, letterSpacing: '0.01em' }}
                >
                  API Key
                  {configured && maskedApiKey && (
                    <Box component="span" sx={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)', ml: 1 }}>
                      ({maskedApiKey})
                    </Box>
                  )}
                </Typography>
                <Box
                  component="input"
                  ref={apiKeyRef}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-••••••••••••••••••••••••"
                  sx={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#E0E0E0',
                    fontSize: 14,
                    px: 1.75,
                    py: 1.25,
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s, background 0.2s',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.22)',
                      background: 'rgba(255,255,255,0.06)',
                    },
                    '&:focus': {
                      borderColor: 'rgba(32,201,151,0.55)',
                      background: 'rgba(32,201,151,0.06)',
                    },
                    '&::placeholder': { color: 'rgba(255,255,255,0.3)' },
                  }}
                />
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                  Stored encrypted. Leave blank to keep the current key.
                </Typography>
              </Box>
            )}

            {/* Model name */}
            <FieldInput
              label="Model Name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gemini-2.0-flash"
              helper="Optional model identifier for the selected provider."
            />

            {/* Base URL — only for providers that allow custom endpoint */}
            {providerMeta.allowsBaseUrl && (
              <FieldInput
                label="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={providerMeta.baseUrlPlaceholder || 'https://'}
                helper="Custom endpoint override — leave empty for default."
              />
            )}

            {/* Error banner */}
            {error && (
              <Box sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: '10px', background: 'color-mix(in srgb, var(--color-danger-soft) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger-soft) 25%, transparent)' }}>
                <Typography sx={{ color: 'var(--color-danger-soft)', fontSize: 13, fontWeight: 500 }}>{error}</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* ── Footer ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 2.5,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {successMsg ? (
          <Typography sx={{ color: '#20C997', fontSize: 13, fontWeight: 500 }}>{successMsg}</Typography>
        ) : (
          <Box />
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={onClose}
            sx={{
              px: 2,
              py: 1.15,
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              color: '#E0E0E0',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              '&:hover': { background: 'rgba(255,255,255,0.1)' },
            }}
            disabled={saving}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving}
            sx={{
              px: 3,
              py: 1.15,
              borderRadius: '12px',
              background: '#20C997',
              color: '#0A1628',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
              textTransform: 'none',
              boxShadow: '0 6px 20px rgba(32,201,151,0.25)',
              '&:hover': { background: 'var(--color-teal-hover)', boxShadow: '0 6px 24px rgba(32,201,151,0.4)' },
            }}
          >
            {saving ? <CircularProgress size={16} sx={{ mr: 1, color: '#0A1628' }} /> : null}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}