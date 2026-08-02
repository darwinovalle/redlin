import React from 'react';
import { Box, Button, TextField } from '@mui/material';

// Controlled form: parent mantiene value y onChange.
const FeynmanAttemptForm = ({ value, onChange, onSubmit, disabled, countdownSeconds, totalSeconds }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
  };
  const timeInfo = (countdownSeconds != null && totalSeconds != null)
    ? `${countdownSeconds}s left`
    : null;
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label={timeInfo ? `Explain in your own words (${timeInfo})` : 'Explain in your own words (Markdown supported)'}
        multiline
        minRows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        fullWidth
        InputLabelProps={{ sx: { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
        InputProps={{
          sx: {
            color: 'var(--color-white)',
            bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
            borderRadius: 2,
            '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 12%, transparent)' },
            '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)' },
            '&.Mui-focused fieldset': { borderColor: 'color-mix(in srgb, var(--color-success) 65%, transparent)' },
          },
        }}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={disabled || !value.trim()}
        sx={{
          alignSelf: 'flex-end',
          backgroundColor: 'var(--color-success)',
          color: 'var(--color-navy-deep)',
          borderRadius: '999px',
          px: 4,
          fontWeight: 800,
          '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
          '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
        }}
      >
        Submit Explanation
      </Button>
    </Box>
  );
};
export default FeynmanAttemptForm;
