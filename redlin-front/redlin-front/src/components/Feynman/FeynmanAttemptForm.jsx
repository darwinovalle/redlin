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
    <Box component="form" onSubmit={handleSubmit} sx={{ mt:2, display:'flex', flexDirection:'column', gap:2, color:'#000' }}>
      <TextField
        label={timeInfo ? `Explain in your own words (${timeInfo})` : 'Explain in your own words (Markdown supported)'}
        multiline
        minRows={6}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        disabled={disabled}
        InputLabelProps={{ sx:{ color:'#000'} }}
        InputProps={{ sx:{ color:'#000'} }}
      />
      <Button type="submit" variant="contained" disabled={disabled || !value.trim()} sx={{ alignSelf:'flex-end', background:'#000', borderRadius:'20px' }}>Submit Explanation</Button>
    </Box>
  );
};
export default FeynmanAttemptForm;
