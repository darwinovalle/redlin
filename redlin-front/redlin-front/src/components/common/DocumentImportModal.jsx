import React, { useRef, useState } from 'react';
import { Dialog, IconButton, Box, Typography, Button, TextField, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import GearSvg from '../../assets/Gear@1x-0.2s-200px-200px (1).svg';
import { documentService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// Same quality budget as chapters: a document over this many characters cannot be
// processed well, so the import is denied instead of silently truncating.
const MAX_DOC_CHARS = 60000;

// Dedicated "Import Document" popup (no other space options):
//  1) pick a PDF, 2) optionally set a title, 3) we check the character count
//     (over the 60k limit → denied), 4) a "Process document" button appears,
//     5) an engine loader shows while it processes, then the popup closes and
//     the user lands back on /documents with the new document listed.
const DocumentImportModal = ({ open, onClose, onImported }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [checkedChars, setCheckedChars] = useState(null); // null until validated
  const [overLimit, setOverLimit] = useState(false);
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Count characters in the PDF via its text layer; stop as soon as we exceed
  // the limit (same technique used by the book uploader).
  const countChars = async (file) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      chars += tc.items.reduce((sum, it) => sum + (it.str ? it.str.length : 0), 0);
      if (chars > MAX_DOC_CHARS) break;
    }
    try { doc.destroy(); } catch {}
    return chars;
  };

  const handleFile = async (file) => {
    if (!file || checking || processing) return;
    setSelectedFile(file);
    setTitle((prev) => (prev.trim() ? prev : file.name.replace(/\.pdf$/i, '').trim()));
    setError(null);
    setOverLimit(false);
    setCheckedChars(null);
    setChecking(true);
    try {
      const chars = await countChars(file);
      if (chars > MAX_DOC_CHARS) {
        setOverLimit(true);
        setError(
          `This PDF is over the ${MAX_DOC_CHARS.toLocaleString()} character limit (detected ~${chars.toLocaleString()} characters). ` +
            'Split it into chapters with Books, or choose a shorter document.'
        );
      } else {
        setCheckedChars(chars);
      }
    } catch (e) {
      console.error('PDF read failed', e);
      setError('Could not read this PDF. Make sure it has a selectable text layer.');
    } finally {
      setChecking(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile || processing) return;
    if (!user?.id) { setError('You must be signed in to upload a document.'); return; }
    setError(null);
    setProcessing(true);
    try {
      await documentService.uploadDocument(selectedFile, user.id, title);
      onImported?.();
      onClose();
    } catch (e) {
      console.error('Document upload failed', e);
      setError(e?.error || 'Upload failed. Please try again.');
      setProcessing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) handleFile(e.dataTransfer.files[0]);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const busy = checking || processing;

  return (
    <Dialog
      open={open}
      onClose={processing ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        style: { background: 'linear-gradient(135deg, var(--color-navy-050) 0%, var(--color-navy-200) 48%, var(--color-navy) 100%)' },
        sx: {
          width: { xs: '92vw', sm: 540 },
          maxWidth: '92vw',
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
      }}
    >
      {/* teal / blue glows */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--color-teal) 18%, transparent), transparent 45%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--color-blue) 20%, transparent), transparent 48%)' }} />

      <Box sx={{ position: 'relative', p: { xs: 2.5, md: 3.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--color-teal) 18%, transparent)', color: 'var(--color-teal)' }}>
              <CloudUploadIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>Import a Document</Typography>
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                Give your document a title, then upload it — up to {MAX_DOC_CHARS.toLocaleString()} characters.
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" disabled={busy} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <TextField
          fullWidth
          label="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          placeholder="e.g. Data Structures Notes"
          inputProps={{ maxLength: 80 }}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 4%, transparent)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&:hover fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 24%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
        />

        <Box
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          sx={{
            textAlign: 'center',
            px: { xs: 1, md: 2 },
            py: { xs: 2.5, md: 3 },
            border: '1px dashed color-mix(in srgb, var(--color-teal) 40%, transparent)',
            borderRadius: '16px',
            backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-teal) 11%, transparent) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            backgroundColor: isDragging ? 'color-mix(in srgb, var(--color-teal) 10%, transparent)' : 'transparent',
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 62, height: 62, borderRadius: '50%', border: '2px dashed color-mix(in srgb, var(--color-teal) 45%, transparent)', mb: 1.5, color: 'var(--color-teal)', background: 'color-mix(in srgb, var(--color-teal) 8%, transparent)' }}>
            <CloudUploadIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="body2" sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 70%, transparent)' }}>
            Drag and drop your PDF here, or
          </Typography>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            sx={{
              borderRadius: '999px',
              px: 3.5,
              py: 1.2,
              background: 'var(--color-teal)',
              color: 'var(--color-navy-deep)',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 10px 28px color-mix(in srgb, var(--color-teal) 30%, transparent)',
              '&:hover': { background: 'var(--color-teal-pale)' },
            }}
          >
            {checking ? 'Checking characters…' : 'Choose PDF file'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => { handleFile(e.target.files?.[0]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
          />

          {selectedFile && !busy && checkedChars != null && !overLimit && (
            <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'var(--color-success)', fontWeight: 600 }}>
                ✓ {selectedFile.name} · {checkedChars.toLocaleString()} characters (within the limit)
              </Typography>
              <Button
                variant="contained"
                onClick={handleProcess}
                disabled={busy}
                sx={{
                  borderRadius: '999px',
                  px: 4,
                  py: 1.15,
                  background: 'var(--color-success)',
                  color: 'var(--color-navy-deep)',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 10px 28px color-mix(in srgb, var(--color-success) 30%, transparent)',
                  '&:hover': { background: 'var(--color-teal-pale)' },
                }}
              >
                Process document
              </Button>
            </Box>
          )}

          {error && !busy && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2, textAlign: 'left' }}>{error}</Alert>
          )}
        </Box>

        {/* Engine loader — centered over the popup while the document processes */}
        {processing && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, background: 'color-mix(in srgb, var(--color-navy-800) 96%, transparent)', backdropFilter: 'blur(3px)', borderRadius: '20px' }}>
            <img src={GearSvg} alt="Loading" width={64} height={64} />
            <Typography variant="body1" sx={{ color: 'var(--color-white)', fontWeight: 600 }}>Processing your document…</Typography>
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Generating summary, questions, and practice items</Typography>
            <CircularProgress size={20} sx={{ color: 'var(--color-teal)', mt: 1 }} />
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

export default DocumentImportModal;