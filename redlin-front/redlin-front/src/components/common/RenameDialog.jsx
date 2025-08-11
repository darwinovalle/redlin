import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

export default function RenameDialog({
  open,
  initialValue = '',
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue || '');
  }, [open, initialValue]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!value?.trim() || submitting) return;
    onSubmit?.(value.trim());
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs"
    PaperProps={{
        sx: {
          borderRadius: 4,
          boxShadow: 20,
          overflow: 'hidden',
          backgroundColor: '#000000',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Rename document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Title"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={submitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>

          <Button
            type="submit"
            variant="contained"
            disabled={!value.trim() || value.trim() === (initialValue || '').trim() || submitting}
            sx={{
              color: 'white',
              borderRadius: 2,
              px: 3,
              backgroundColor: (t) => t.palette.grey[700],
              '&:hover': { backgroundColor: (t) => t.palette.grey[600] },
            }}
          >
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
