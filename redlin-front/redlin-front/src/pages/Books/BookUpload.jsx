import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { documentService } from '../../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const THUMB_WIDTH = 140;
const THUMB_SCALE = 0.35;
const BATCH = 24;
// Quality budget: a single chapter processes at most this many characters so the
// LLM produces focused, accurate study items. Keep in sync with the backend
// MAX_CHAPTER_CHARS env (default 60000).
const MAX_CHAPTER_CHARS = 60000;

// Renders a single page thumbnail from the loaded PDF document.
const PageThumb = ({ pdf, page, selected, onSelect, onExpand }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await pdf.getPage(page);
        const viewport = p.getViewport({ scale: THUMB_SCALE });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        await p.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error('Thumb render failed', page, e);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, page]);

  return (
    <Box
      onClick={() => onSelect(page)}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        borderRadius: 2,
        border: selected ? '2px solid var(--color-teal)' : '2px solid transparent',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--color-teal) 35%, transparent)' : 'none',
        p: 0.5,
        bgcolor: 'color-mix(in srgb, var(--color-white) 3%, transparent)',
        '&:hover': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' },
      }}
    >
      <canvas ref={canvasRef} style={{ width: THUMB_WIDTH, height: 'auto', background: 'white', display: 'block', borderRadius: 4 }} />
      <Typography variant="caption" sx={{ color: 'var(--color-white)', display: 'block', textAlign: 'center', mt: 0.25 }}>
        {page}
      </Typography>
      {/* Expand button — opens a larger read-only preview of this page */}
      <Box
        component="button"
        type="button"
        onClick={(e) => { e.stopPropagation(); onExpand?.(page); }}
        title={`Preview page ${page}`}
        aria-label={`Preview page ${page}`}
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.45)',
          cursor: 'pointer',
          padding: 0,
          zIndex: 2,
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <ZoomInIcon sx={{ fontSize: 15 }} />
      </Box>
    </Box>
  );
};

const PREVIEW_WIDTH = 1000;

// Large, read-only preview of a single page so the user can inspect it before
// deciding to process it. No editing here — just a bigger view + a close button
// (or clicking the dimmed backdrop) to dismiss.
const PagePreview = ({ pdf, page, onClose }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await pdf.getPage(page);
        const base = p.getViewport({ scale: 1 });
        const scale = PREVIEW_WIDTH / base.width;
        const viewport = p.getViewport({ scale });
        const canvas = canvasRef.current;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } catch (e) {
        console.error('Preview render failed', page, e);
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, page]);

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 70%, transparent)', backdropFilter: 'blur(4px)' } },
      }}
      PaperProps={{
        sx: { width: 'min(1100px, 92vw)', maxWidth: '92vw', borderRadius: '20px', bgcolor: 'var(--color-navy-800)', overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.6)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', background: 'var(--color-navy-deep)' }}>
        <Typography sx={{ color: 'var(--color-white)', fontWeight: 700 }}>Page {page} — preview</Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close preview" title="Close" sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', overflow: 'auto', maxHeight: '75vh' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', background: 'white', borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }} />
      </Box>
    </Dialog>
  );
};

const BookUpload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `/books/new?bookId=X` → "add chapters to an existing book" mode: the PDF is
  // already uploaded, so the user only picks page ranges for the new chapters.
  const existingBookId = searchParams.get('bookId');
  const isAddMode = Boolean(existingBookId);
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [pdf, setPdf] = useState(null); // loaded pdf.js document
  const [analyzing, setAnalyzing] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [pageChars, setPageChars] = useState([]); // per-page char counts (1-indexed)
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const [filterFrom, setFilterFrom] = useState(null);
  const [filterTo, setFilterTo] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [creating, setCreating] = useState(false);
  const [previewPage, setPreviewPage] = useState(null); // page-id shown in the read-only preview modal
  const [error, setError] = useState(null);

  const handleFile = async (selected) => {
    if (!selected) return;
    setError(null);
    // Shorten the uploaded file's name: the backend FileField only fits ~100
    // chars, and very long PDF filenames (long book titles) would break the
    // upload. The user-facing title keeps its full (truncated) name.
    const base = (selected.name || 'book.pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'book';
    const renamed = new File([selected], `${base}.pdf`, { type: selected.type || 'application/pdf' });
    setFile(renamed);
    if (!title) setTitle(selected.name.replace(/\.pdf$/i, '').trim().slice(0, 80));
    setAnalyzing(true);
    try {
      const data = new Uint8Array(await renamed.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      setPdf(doc);
      setTotalPages(doc.numPages);

      // Per-page char count (cheap first pass) for the budget note.
      let chars = 0;
      const perPage = [0]; // 1-indexed; index 0 unused
      for (let p = 1; p <= doc.numPages; p += 1) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const pageCh = tc.items.reduce((sum, it) => sum + (it.str ? it.str.length : 0), 0);
        perPage.push(pageCh);
        chars += pageCh;
      }
      setTotalChars(chars);
      setPageChars(perPage);
      setSelStart(null);
      setSelEnd(null);
      setChapters([]);
      setVisibleCount(Math.min(BATCH, doc.numPages));
    } catch (e) {
      console.error(e);
      setError('Could not read this PDF. Make sure it has a selectable text layer.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Add-chapters mode: load the existing book's PDF from the server so the page
  // picker works without a re-upload.
  const loadExistingBook = useCallback(async () => {
    if (!existingBookId) return;
    setError(null);
    setAnalyzing(true);
    try {
      let access = null;
      try { access = JSON.parse(localStorage.getItem('auth') || '{}').access; } catch {}
      const doc = await pdfjs.getDocument({
        url: documentService.getPdfUrl(existingBookId),
        httpHeaders: access ? { Authorization: `Bearer ${access}` } : {},
      }).promise;
      setPdf(doc);
      setTotalPages(doc.numPages);

      let chars = 0;
      const perPage = [0]; // 1-indexed; index 0 unused
      for (let p = 1; p <= doc.numPages; p += 1) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const pageCh = tc.items.reduce((sum, it) => sum + (it.str ? it.str.length : 0), 0);
        perPage.push(pageCh);
        chars += pageCh;
      }
      setTotalChars(chars);
      setPageChars(perPage);
      setSelStart(null);
      setSelEnd(null);
      setChapters([]);
      setVisibleCount(Math.min(BATCH, doc.numPages));
    } catch (e) {
      console.error(e);
      setError('Could not read the book PDF.');
    } finally {
      setAnalyzing(false);
    }
  }, [existingBookId]);

  useEffect(() => { loadExistingBook(); }, [loadExistingBook]);

  const onSelectPage = (page) => {
    if (selStart === null) {
      setSelStart(page);
      setSelEnd(null);
    } else if (selEnd === null) {
      setSelEnd(page >= selStart ? page : page);
    } else {
      setSelStart(page);
      setSelEnd(null);
    }
  };

  const rangeStart = selStart === null || selEnd === null ? selStart : Math.min(selStart, selEnd);
  const rangeEnd = selStart === null || selEnd === null ? null : Math.max(selStart, selEnd);
  // Character count for the currently selected page range, and whether it
  // exceeds the per-chapter quality budget.
  const rangeChars = selStart == null || selEnd == null
    ? null
    : pageChars.slice(Math.min(selStart, selEnd), Math.max(selStart, selEnd) + 1).reduce((sum, c) => sum + (c || 0), 0);
  const overBudget = rangeChars != null && rangeChars > MAX_CHAPTER_CHARS;

  // Highlight the "from" page immediately on first click; once both ends are
  // picked, highlight every page in the range between them.
  const isSelected = (p) => {
    if (selStart == null) return false;
    if (selEnd == null) return p === selStart;
    return p >= Math.min(selStart, selEnd) && p <= Math.max(selStart, selEnd);
  };

  const addChapter = () => {
    if (rangeStart == null || rangeEnd == null) return;
    if (overBudget) return; // the user must split the chapter instead
    setChapters((prev) => [
      ...prev,
      { title: `Chapter ${prev.length + 1}`, page_start: rangeStart, page_end: rangeEnd },
    ]);
    setSelStart(null);
    setSelEnd(null);
  };

  const updateChapter = (index, field, value) => {
    setChapters((prev) => prev.map((ch, i) => (i === index ? { ...ch, [field]: value } : ch)));
  };

  const removeChapter = (index) => {
    setChapters((prev) => prev.filter((_, i) => i !== index));
  };

  const canCreate = chapters.length > 0
    && chapters.every((ch) => ch.title?.trim() && ch.title.trim().length <= 80 && Number(ch.page_start) > 0)
    && (isAddMode || (title.trim() && title.trim().length <= 80 && file));

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setError(null);
    try {
      const payload = chapters.map((ch) => ({
        title: ch.title.trim(),
        page_start: Math.max(1, Number(ch.page_start) || 1),
        page_end: Number(ch.page_end) || null,
      }));
      if (isAddMode) {
        await documentService.addBookChapters(existingBookId, payload);
        navigate(`/books/${existingBookId}`);
      } else {
        await documentService.createBook({ title: title.trim(), file, chapters: payload, totalPages });
        navigate('/books');
      }
    } catch (e) {
      console.error(e);
      setError(e?.detail || e?.message || (isAddMode ? 'Failed to add chapters' : 'Failed to create book'));
      setCreating(false);
    }
  };

  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);
  const visiblePages = pages.slice(0, visibleCount);

  // Page filter (From/To): when set, only those pages are shown.
  const fromP = filterFrom != null ? Math.max(1, Math.min(filterFrom, totalPages)) : null;
  const toP = filterTo != null ? Math.min(Math.max(filterTo, 1), totalPages) : null;
  const displayPages = useMemo(() => {
    if (fromP != null || toP != null) {
      const start = (fromP ?? 1) - 1;
      const end = toP ?? totalPages;
      return pages.slice(start, end);
    }
    return pages.slice(0, visibleCount);
  }, [pages, totalPages, fromP, toP, visibleCount]);

  // Apply the typed From/To range as the selected chapter range.
  const selectRange = () => {
    if (fromP == null || toP == null) return;
    setSelStart(Math.min(fromP, toP));
    setSelEnd(Math.max(fromP, toP));
  };

  return (
    <Box sx={{ width: '100%', height: '100vh', background: 'var(--color-navy-deep)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header (fixed, solid navy with divider) */}
      <Box sx={{ p: 4, pb: 2, flexShrink: 0, background: 'var(--color-navy-deep)', borderBottom: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(isAddMode ? `/books/${existingBookId}` : '/books')}
          sx={{ mb: 1.5, color: 'color-mix(in srgb, var(--color-white) 70%, transparent)', textTransform: 'none', fontWeight: 600, flexShrink: 0, '&:hover': { color: 'var(--color-white)' } }}
        >
          Back to books
        </Button>
        <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.95, mb: '14px', maxWidth: '18ch', color: 'var(--color-white)' }}>
          {isAddMode ? 'Add chapters' : 'Add a book'}
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: '56ch', color: 'color-mix(in srgb, var(--color-white) 74%, transparent)' }}>
          {isAddMode ? (
            <>Pick a start page and an end page for each new chapter, then <b>add them</b> to the book. Each chapter becomes its own study space.</>
          ) : (
            <>Upload a long PDF, then <b>click a start page and an end page</b> to mark each chapter range. Each chapter becomes its own study space (summary, quiz, cloze, Feynman).</>
          )}
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{String(error)}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          {!isAddMode ? (
            <>
              <TextField
                label="Book title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                inputProps={{ maxLength: 80 }}
                helperText={title.length >= 80 ? 'Book titles are limited to 80 characters.' : undefined}
                sx={{ flex: '1 1 260px', maxWidth: 440, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' }, '&.Mui-focused fieldset': { borderColor: 'var(--color-teal)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }, '& .MuiFormHelperText-root': { color: 'var(--color-amber)' } }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ borderRadius: '999px', px: 3, py: 1.1, textTransform: 'none', fontWeight: 700, color: 'var(--color-white)', borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)', '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' } }}
              >
                {file ? 'Change PDF' : 'Choose PDF'}
              </Button>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
              Adding chapters to an existing book — its PDF is already uploaded. Select page ranges below.
            </Typography>
          )}
          {analyzing && (
            <>
              <CircularProgress size={20} sx={{ color: 'var(--color-teal)' }} />
              <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Reading the book…</Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Body: two panes */}
      {pdf ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 3, px: 4, pb: 4, backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-white) 12%, transparent) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          {/* LEFT: page selector (scrolls to browse pages) */}
          <Box sx={{ flex: '1 1 65%', minWidth: 0, overflowY: 'auto', pr: 1 }}>
            <Box sx={{ position: 'sticky', top: 0, zIndex: 5, p: 2, borderRadius: 3, background: 'color-mix(in srgb, var(--color-navy-800) 94%, transparent)', backdropFilter: 'blur(6px)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ flexBasis: '100%' }}>
                <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 82%, transparent)' }}>
                  <b>{totalPages}</b> pages · ~{totalChars.toLocaleString()} characters
                </Typography>
                <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 55%, transparent)', display: 'block', mt: 0.25 }}>
                  Each chapter processes up to <b>{(MAX_CHAPTER_CHARS / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k characters</b> for the best-quality materials. If a chapter is bigger, split it into multiple chapters.
                </Typography>
              </Box>
              {selStart != null && selEnd != null ? (
                <Chip
                  label={overBudget ? `Chapter: pages ${rangeStart}–${rangeEnd} (~${rangeChars.toLocaleString()} chars)` : `Add chapter: pages ${rangeStart}–${rangeEnd} (~${rangeChars.toLocaleString()} chars)`}
                  onDelete={overBudget ? undefined : addChapter}
                  deleteIcon={overBudget ? undefined : <ChevronRightIcon />}
                  onClick={overBudget ? undefined : addChapter}
                  color={overBudget ? 'default' : 'primary'}
                  disabled={overBudget}
                  sx={{ fontWeight: 700, color: overBudget ? 'color-mix(in srgb, var(--color-white) 55%, transparent)' : 'var(--color-white)', '& .MuiChip-label': { color: overBudget ? 'color-mix(in srgb, var(--color-white) 55%, transparent)' : 'var(--color-navy-deep)' } }}
                />
              ) : (
                <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 65%, transparent)' }}>
                  {selStart != null ? `Selected start page ${selStart} — now click an end page.` : 'Click a start page, then an end page to define a chapter.'}
                </Typography>
              )}
              {overBudget && (
                <Typography variant="caption" sx={{ color: 'var(--color-amber)', display: 'block', flexBasis: '100%', mt: 0.5 }}>
                  This range is over the {(MAX_CHAPTER_CHARS / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k character limit. Split it into two chapters with smaller page ranges so each is processed fully.
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <TextField
                type="number"
                label="From page"
                value={filterFrom ?? ''}
                onChange={(e) => setFilterFrom(e.target.value === '' ? null : Number(e.target.value))}
                size="small"
                inputProps={{ min: 1, max: totalPages }}
                sx={{ width: 120, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
              />
              <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 70%, transparent)' }}>to</Typography>
              <TextField
                type="number"
                label="To page"
                value={filterTo ?? ''}
                onChange={(e) => setFilterTo(e.target.value === '' ? null : Number(e.target.value))}
                size="small"
                inputProps={{ min: 1, max: totalPages }}
                sx={{ width: 120, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' } }, '& .MuiInputLabel-root': { color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' } }}
              />
              {fromP != null && toP != null && (
                <Button size="small" onClick={selectRange} sx={{ color: 'var(--color-teal)', textTransform: 'none', fontWeight: 700 }}>Select</Button>
              )}
              {(filterFrom != null || filterTo != null) && (
                <Button size="small" onClick={() => { setFilterFrom(null); setFilterTo(null); }} sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', textTransform: 'none', fontWeight: 600 }}>Clear</Button>
              )}
              <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)', ml: 'auto' }}>
                Showing {displayPages.length} page{displayPages.length === 1 ? '' : 's'}
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
              {displayPages.map((p) => (
                <PageThumb key={p} pdf={pdf} page={p} selected={isSelected(p)} onSelect={onSelectPage} onExpand={setPreviewPage} />
              ))}
            </Box>

            {!filterFrom && !filterTo && visibleCount < totalPages && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button onClick={() => setVisibleCount((v) => Math.min(totalPages, v + BATCH))} sx={{ borderRadius: '999px', px: 3, textTransform: 'none', fontWeight: 700, color: 'var(--color-white)', borderColor: 'color-mix(in srgb, var(--color-white) 22%, transparent)', '&:hover': { borderColor: 'var(--color-teal)', backgroundColor: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' } }}>
                  Show more pages ({visibleCount} / {totalPages})
                </Button>
              </Box>
            )}
          </Box>

          {/* RIGHT: chapters panel */}
          <Box sx={{ flex: '0 0 35%', minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ borderRadius: 3, background: 'color-mix(in srgb, var(--color-navy-800) 94%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle2" sx={{ color: 'var(--color-white)', fontWeight: 700 }}>
                Chapters ({chapters.length})
              </Typography>
              {chapters.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed color-mix(in srgb, var(--color-white) 18%, transparent)', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: 'color-mix(in srgb, var(--color-white) 62%, transparent)' }}>
                    No chapters yet. Pick a start and end page on the left, then click <b>Add chapter</b>.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {chapters.map((ch, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2.5, background: 'color-mix(in srgb, var(--color-white) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
                      <Chip label={`${ch.page_start}–${ch.page_end}`} size="small" sx={{ color: 'var(--color-white)', bgcolor: 'color-mix(in srgb, var(--color-teal) 16%, transparent)', fontWeight: 700, flexShrink: 0 }} />
                      <TextField
                        value={ch.title}
                        onChange={(e) => updateChapter(i, 'title', e.target.value)}
                        size="small"
                        placeholder="Chapter title"
                        inputProps={{ maxLength: 80 }}
                        sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { color: 'var(--color-white)', fontSize: 14, '& fieldset': { borderColor: 'color-mix(in srgb, var(--color-white) 14%, transparent)' } } }}
                      />
                      <IconButton onClick={() => removeChapter(i)} size="small" aria-label="Remove chapter" sx={{ color: 'var(--color-danger-soft)' }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Button
              variant="contained"
              disabled={!canCreate || creating}
              onClick={create}
              sx={{
                borderRadius: '999px',
                px: 4,
                py: 1.15,
                fontWeight: 700,
                textTransform: 'none',
                width: '100%',
                backgroundColor: 'var(--color-success)',
                color: 'var(--color-navy-deep)',
                '&:hover': { backgroundColor: 'var(--color-teal-pale)' },
                '&.Mui-disabled': { bgcolor: 'color-mix(in srgb, var(--color-white) 8%, transparent)', color: 'color-mix(in srgb, var(--color-white) 36%, transparent)' },
              }}
            >
              {creating ? (isAddMode ? 'Adding…' : 'Creating…') : (isAddMode ? 'Add chapters' : 'Create book')}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 6, backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-white) 12%, transparent) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          <Box sx={{ textAlign: 'center', maxWidth: 420, background: 'var(--color-navy-deep)', border: '1px dashed color-mix(in srgb, var(--color-white) 18%, transparent)', borderRadius: 4, p: 6, boxShadow: '0 18px 48px color-mix(in srgb, var(--color-black) 24%, transparent)' }}>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'color-mix(in srgb, var(--color-white) 30%, transparent)', mb: 1.5 }} />
            <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>
              {isAddMode ? 'Loading the book PDF…' : 'Choose a PDF above to start splitting it into chapters.'}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Read-only larger preview of a single page */}
      {pdf && previewPage != null && (
        <PagePreview pdf={pdf} page={previewPage} onClose={() => setPreviewPage(null)} />
      )}
    </Box>
  );
};
export default BookUpload;
