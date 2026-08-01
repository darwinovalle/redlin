import React from 'react';
import { Box, Button, TextField } from '@mui/material';

// Controlled form: parent mantiene value y onChange.
const FeynmanAttemptForm = ({ value, onChange, onSubmit, disabled, countdownSeconds, totalSeconds }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if(!value.trim()) return;
    onSubmit(value);
  };
  const timeInfo = (countdownSeconds!=null && totalSeconds!=null)
    ? `${countdownSeconds}s left`
    : null;
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt:2, display:'flex', flexDirection:'column', gap:2, color:'var(--color-black)' }}>
      <TextField
        label={timeInfo ? `Explain in your own words (${timeInfo})` : 'Explain in your own words (Markdown supported)'}
        multiline
        minRows={6}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        disabled={disabled}
        InputLabelProps={{ sx:{ color:'var(--color-black)'} }}
        InputProps={{ sx:{ color:'var(--color-black)'} }}
      />
      <Button type="submit" variant="contained" disabled={disabled || !value.trim()} sx={{ alignSelf:'flex-end', background:'var(--color-black)', borderRadius:'20px' }}>Submit Explanation</Button>
    </Box>
  );
};
export default FeynmanAttemptForm;
