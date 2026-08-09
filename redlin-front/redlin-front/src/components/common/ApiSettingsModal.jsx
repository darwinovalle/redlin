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
        '& option': { backgroundColor: 'var(--color-navy-600)', color: '#E0E0E0' },
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
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: {
          width: { xs: '92vw', sm: 520 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
    >
      {/* teal / blue glows */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 18%, transparent), transparent 45%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 20%, transparent), transparent 48%)' }} />

      {/* Header */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2.5,
          borderBottom: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)' }}>
            <SettingsIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              API Settings
            </Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
              Choose an LLM provider to power generation &amp; scoring.
            </Typography>
            {configured && (
              <Box component="span" sx={{ display: 'inline-block', mt: 0.25, px: 1, py: '1px', borderRadius: '999px', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }}>
                CONFIGURED
              </Box>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', '&:hover': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ position: 'relative', px: 3, pt: 3, pb: 1 }}>
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
              px: 3,
              py: 1.15,
              borderRadius: '999px',
              background: 'transparent',
              border: '1px solid color-mix(in srgb, var(--color-white) 22%, transparent)',
              color: '#E0E0E0',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              '&:hover': { borderColor: 'var(--color-teal)' },
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
              borderRadius: '999px',
              background: 'var(--color-teal)',
              color: 'var(--color-navy-deep)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.02em',
              textTransform: 'none',
              boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)',
              '&:hover': { background: 'var(--color-teal-pale)' },
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