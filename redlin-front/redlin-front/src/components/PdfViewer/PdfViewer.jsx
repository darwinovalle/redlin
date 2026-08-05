import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import IconButton from '@mui/material/IconButton';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ViewerProvider, useViewer } from './ViewerContext';
import PdfToolbar from './PdfToolbar';
import { documentService } from '../../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const HIGHLIGHT_COLORS = ['#FDE047', '#C084FC', '#86EFAC', '#93C5FD', '#FCA5A5']; // yellow, purple, green, blue, red

const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const expanded = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(expanded, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const getDocId = (u) => {
  const m = (u || '').match(/\/documents\/(\d+)\/file\//);
  return m ? m[1] : null;
};

// Continuous scroll: every page is rendered stacked so scrolling flows
// naturally from one page to the next (no page remount / blink).
// `pageRange` ([start, end]) restricts the viewer to only those PDF pages —
// used for book chapters ("no more no less"). Pass null to show every page.
function InnerViewer({ url, initialPage, pageRange, onPageCount }) {
  const { state, dispatch } = useViewer();
  const pdfRef = useRef(null);
  const searchJobRef = useRef(null);
  const scrollRef = useRef(null);
  const viewerRootRef = useRef(null);
  const navStateRef = useRef({ page: state.page, numPages: state.numPages });
  navStateRef.current = { page: state.page, numPages: state.numPages };

  // Text highlights (persisted to the backend per user + document).
  const [highlights, setHighlights] = useState([]);
  const [palettePos, setPalettePos] = useState(null);
  const [selectionRects, setSelectionRects] = useState([]);
  const [selectionText, setSelectionText] = useState('');
  const [selectionPage, setSelectionPage] = useState(1);
  // Search-match boxes for the current page (derived from the text layer).
  const [searchBoxes, setSearchBoxes] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Virtualized render window: only pages up to `renderEnd` are mounted, and the
  // window grows as the user scrolls — a large book isn't fully rendered at once.
  const [renderEnd, setRenderEnd] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [pageW, setPageW] = useState(0);

  const fileObj = React.useMemo(() => {
    if (!url) return null;
    let access = null;
    try { access = JSON.parse(localStorage.getItem('auth') || '{}').access; } catch {}
    return access ? { url, httpHeaders: { Authorization: `Bearer ${access}` } } : { url };
  }, [url]);

  const onLoadSuccess = (pdf) => {
    pdfRef.current = pdf;
    dispatch({ type: 'SET_NUM_PAGES', numPages: pdf.numPages });
    dispatch({ type: 'SET_PAGE', page: 1 });
    onPageCount?.(pdf.numPages);
  };

  // Load saved highlights for this document.
  useEffect(() => {
    let cancelled = false;
    const docId = getDocId(url);
    setHighlights([]);
    if (!docId) return undefined;
    (async () => {
      try {
        const data = await documentService.getHighlights(docId);
        if (!cancelled) setHighlights(data || []);
      } catch (e) {
        console.error('Load highlights failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // Which page is most in view, based on the scroll position. Reads the real
  // `data-page-number` off each rendered page (so it's correct even when the
  // first rendered page is not page 1, e.g. a chapter range or virtualized set).
  const updateCurrentPageFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('.react-pdf__Page');
    if (!pages.length) return;
    const containerTop = el.getBoundingClientRect().top;
    const threshold = el.clientHeight * 0.35;
    let current = 1;
    for (let i = 0; i < pages.length; i++) {
      const top = pages[i].getBoundingClientRect().top - containerTop;
      if (top < threshold) {
        const n = parseInt(pages[i].getAttribute('data-page-number'), 10);
        if (n) current = n;
      } else break;
    }
    if (current !== navStateRef.current.page) dispatch({ type: 'SET_PAGE', page: current });
  }, [dispatch]);

  const scrollToPage = useCallback((p) => {
    const el = scrollRef.current;
    const pageEl = el?.querySelector(`.react-pdf__Page[data-page-number="${p}"]`);
    if (!el || !pageEl) return;
    const containerRect = el.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    el.scrollTop += (pageRect.top - containerRect.top) - 8;
  }, []);

  // Visible page window: when `pageRange` is set (a book chapter), render only
  // [start, end] of the PDF; otherwise the whole document. Declared before the
  // effects below so their dependency arrays can reference these safely.
  const hasRange = Boolean(pageRange && pageRange.length >= 2);
  const rangeStart = hasRange ? Math.max(1, Number(pageRange[0]) || 1) : 1;
  const rangeEnd = hasRange
    ? (Number(pageRange[1]) > 0 ? Number(pageRange[1]) : state.numPages || 0)
    : (state.numPages || 0);

  const pageNumbers = state.numPages > 0
    ? Array.from({ length: state.numPages }, (_, i) => i + 1).filter((p) => p >= rangeStart && p <= rangeEnd)
    : [];

  // Virtualized window tuning.
  const PAGE_GAP = 16; // matches the margin-bottom on each page wrapper
  const INITIAL_RENDER = 6;
  const PRELOAD = 5;

  // Measure the (uniform) page size so the spacer below the rendered set keeps
  // the scrollbar spanning the whole PDF while only a few pages are mounted.
  useEffect(() => {
    if (!pdfRef.current || !state.numPages) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await pdfRef.current.getPage(rangeStart);
        const vp = p.getViewport({ scale: state.scale });
        if (!cancelled) { setPageH(vp.height); setPageW(vp.width); }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, state.scale, state.numPages]);

  // Reset the render window whenever the document or active range changes.
  useEffect(() => {
    if (!state.numPages) return;
    setRenderEnd(Math.min(rangeStart + INITIAL_RENDER - 1, rangeEnd));
  }, [state.numPages, rangeStart, rangeEnd]);

  // Grow the window as the user scrolls / jumps so pages mount just before
  // they come into view (render-end only ever increases — no unmount churn).
  useEffect(() => {
    if (!state.numPages) return;
    setRenderEnd((prev) => Math.max(prev, Math.min(state.page + PRELOAD, rangeEnd)));
  }, [state.page, rangeEnd, state.numPages]);

  // Books: when a chapter study opens, jump to the chapter's start page.
  useEffect(() => {
    if (initialPage && state.numPages) {
      const target = Math.min(initialPage, state.numPages);
      dispatch({ type: 'SET_PAGE', page: target });
      const t = setTimeout(() => scrollToPage(target), 120);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage, state.numPages]);

  // Books: when the active chapter changes, jump to that chapter's first page.
  // Guarded by a ref so a range change re-fires (jump) but steady state does not.
  const lastRangeRef = useRef(null);
  useEffect(() => {
    if (!hasRange || !state.numPages) return;
    const key = `${rangeStart}-${rangeEnd}`;
    if (lastRangeRef.current === key) return;
    lastRangeRef.current = key;
    const target = Math.min(rangeStart, state.numPages);
    dispatch({ type: 'SET_PAGE', page: target });
    const t = setTimeout(() => scrollToPage(target), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRange, rangeStart, rangeEnd, state.numPages]);

  // Keep the fullscreen icon in sync with the browser fullscreen state.
  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = viewerRootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el).catch(() => {});
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  }, []);

  // Hide the palette while scrolling and keep the page indicator in sync.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      setPalettePos(null);
      updateCurrentPageFromScroll();
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [updateCurrentPageFromScroll]);

  // Move to the selected search result page (scrolls the continuous view).
  useEffect(() => {
    if (!state.searchResults.length) return;
    const target = state.searchResults[state.currentSearchIndex];
    if (target == null || target === navStateRef.current.page) return;
    // Grow the render window so the target page mounts, then scroll once it's there.
    setRenderEnd((prev) => Math.max(prev, Math.min(target + PRELOAD, rangeEnd || state.numPages)));
    const t = setTimeout(() => scrollToPage(target), 150);
    return () => clearTimeout(t);
  }, [state.searchResults, state.currentSearchIndex, scrollToPage, rangeEnd, state.numPages]);

  // Precise search-match boxes for the current page. Recomputes whenever the
  // text layer DOM changes (react-pdf renders it asynchronously).
  const computeSearchBoxes = useCallback(() => {
    const term = state.searchTerm.trim().toLowerCase();
    const pageEl = scrollRef.current?.querySelector(`.react-pdf__Page[data-page-number="${state.page}"]`);
    const textLayer = pageEl?.querySelector('.textLayer');
    if (!term || !pageEl || !textLayer) { setSearchBoxes([]); return; }
    const pageRect = pageEl.getBoundingClientRect();
    if (!pageRect.width || !pageRect.height) { setSearchBoxes([]); return; }
    const boxes = [];
    const pushRect = (rect) => {
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const x = clamp01((rect.left - pageRect.left) / pageRect.width);
      const y = clamp01((rect.top - pageRect.top) / pageRect.height);
      const w = clamp01((rect.right - pageRect.left) / pageRect.width) - x;
      const h = clamp01((rect.bottom - pageRect.top) / pageRect.height) - y;
      boxes.push({ x, y, w, h });
    };
    Array.from(textLayer.querySelectorAll('span')).forEach((span) => {
      const node = span.firstChild;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const fullText = node.textContent || '';
        const lower = fullText.toLowerCase();
        let idx = lower.indexOf(term);
        while (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + term.length);
          Array.from(range.getClientRects()).forEach(pushRect);
          idx = lower.indexOf(term, idx + term.length);
        }
      } else if ((span.textContent || '').toLowerCase().includes(term)) {
        pushRect(span.getBoundingClientRect());
      }
    });
    setSearchBoxes(boxes);
  }, [state.searchTerm, state.page]);

  useEffect(() => {
    setSearchBoxes([]);
    if (!state.searchTerm.trim()) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    let rafId = null;
    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        computeSearchBoxes();
      });
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [state.searchTerm, state.page, state.scale, computeSearchBoxes]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setPalettePos(null);
      return;
    }
    const fromNode = (n) => {
      if (!n) return null;
      const el = n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement;
      return el ? el.closest('.react-pdf__Page') : null;
    };
    const pageEl = fromNode(sel.anchorNode);
    if (!pageEl || fromNode(sel.focusNode) !== pageEl) { setPalettePos(null); return; }
    const pageNum = parseInt(pageEl.getAttribute('data-page-number'), 10) || 1;
    try {
      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) { setPalettePos(null); return; }
      const pageRect = pageEl.getBoundingClientRect();
      if (!pageRect.width || !pageRect.height) { setPalettePos(null); return; }
      const normalized = rects.map((r) => {
        const x = clamp01((r.left - pageRect.left) / pageRect.width);
        const y = clamp01((r.top - pageRect.top) / pageRect.height);
        const w = clamp01((r.right - pageRect.left) / pageRect.width) - x;
        const h = clamp01((r.bottom - pageRect.top) / pageRect.height) - y;
        return { x, y, w, h };
      });
      const first = rects[0];
      const barWidth = 220;
      setPalettePos({
        x: Math.min(Math.max(first.left, 8), window.innerWidth - barWidth - 8),
        y: Math.max(first.top - 46, 8),
      });
      setSelectionRects(normalized);
      setSelectionText(sel.toString().trim());
      setSelectionPage(pageNum);
    } catch {
      setPalettePos(null);
    }
  }, []);

  const applyHighlight = useCallback(async (color) => {
    const docId = getDocId(url);
    if (!docId || !selectionRects.length) return;
    try {
      const created = await documentService.createHighlight(docId, {
        page: selectionPage,
        text: selectionText,
        color,
        rects: selectionRects,
      });
      setHighlights((h) => [...h, created]);
    } catch (e) {
      console.error('Create highlight failed:', e);
    }
    setPalettePos(null);
    setSelectionRects([]);
    setSelectionText('');
  }, [url, selectionRects, selectionText, selectionPage]);

  const removeHighlight = useCallback(async (id) => {
    const docId = getDocId(url);
    if (!docId) return;
    try {
      await documentService.deleteHighlight(docId, id);
    } catch (e) {
      console.error('Delete highlight failed:', e);
    }
    setHighlights((h) => h.filter((x) => x.id !== id));
  }, [url]);

  // Search pages (simple, sequential)
  useEffect(() => {
    const term = state.searchTerm.trim().toLowerCase();
    if (!pdfRef.current) return;
    const pdf = pdfRef.current;
    const jobId = term ? Date.now() + '-' + Math.random() : null;
    searchJobRef.current = jobId;
    if (!term) { dispatch({ type: 'SEARCH_CANCEL' }); return; }
    dispatch({ type: 'SEARCH_INIT', jobId });
    const from = Math.max(1, rangeStart);
    const to = Math.min(rangeEnd || pdf.numPages, pdf.numPages);
    (async () => {
      for (let p = from; p <= to; p++) {
        if (searchJobRef.current !== jobId) return;
        dispatch({ type: 'SEARCH_PROGRESS', page: p });
        try {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const txt = textContent.items.map(i => i.str).join(' ').toLowerCase();
          if (txt.includes(term)) dispatch({ type: 'SEARCH_ADD_HIT', page: p });
        } catch {}
      }
      if (searchJobRef.current === jobId) dispatch({ type: 'SEARCH_COMPLETE' });
    })();
  }, [state.searchTerm, rangeStart, rangeEnd]);

  return (
    <div ref={viewerRootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <PdfToolbar />
      <div
        ref={scrollRef}
        onMouseUp={handleMouseUp}
        style={{ flex: 1, overflow: 'auto', background: 'var(--color-ink-soft)', display: 'flex', justifyContent: 'center' }}
      >
        <div style={{ padding: '12px 12px 48px', width: 'max-content' }}>
          <Document file={fileObj} onLoadSuccess={onLoadSuccess} loading={<div style={{ padding: 12, color: 'var(--color-white)' }}>Loading PDF…</div>}>
            {pageNumbers.filter((p) => p <= renderEnd).map((p) => (
              <div key={p} style={{ position: 'relative', width: 'max-content', margin: '0 auto 16px' }}>
                <Page pageNumber={p} scale={state.scale} renderTextLayer renderAnnotationLayer />
                {/* Saved text highlights */}
                {highlights.filter((h) => h.page === p).map((h) => h.rects.map((r, idx) => (
                  <div
                    key={`${h.id}-${idx}`}
                    role="button"
                    aria-label="Remove highlight"
                    title="Remove highlight"
                    onClick={(e) => { e.stopPropagation(); removeHighlight(h.id); }}
                    style={{
                      position: 'absolute',
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      backgroundColor: hexToRgba(h.color, 0.45),
                      borderRadius: 2,
                      cursor: 'pointer',
                      zIndex: 3,
                    }}
                  />
                )))}
                {/* Search match overlay for the current page */}
                {p === state.page && searchBoxes.map((r, idx) => (
                  <div
                    key={`search-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      backgroundColor: 'rgba(251,191,36,0.5)',
                      borderRadius: 2,
                      zIndex: 4,
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </div>
            ))}
            {/* Reserve space for pages that aren't rendered yet so the scrollbar
                still spans the whole PDF while only a few pages are mounted. */}
            {state.numPages > 0 && renderEnd < rangeEnd && (
              <div style={{ height: (rangeEnd - renderEnd) * (pageH + PAGE_GAP), width: pageW || '100%' }} />
            )}
          </Document>
        </div>
      </div>
      {state.numPages > 0 && (
        <div style={{ background: 'linear-gradient(90deg,var(--color-text-deep),var(--color-ink-surface))', color: 'var(--color-white)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13, borderTop: '1px solid var(--color-text-strong)' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Page</span>
          <input
            type="number"
            value={state.page}
            min={rangeStart}
            max={rangeEnd || state.numPages}
            onChange={(e) => {
              let v = parseInt(e.target.value, 10) || rangeStart;
              if (v < rangeStart) v = rangeStart;
              if (v > (rangeEnd || state.numPages)) v = rangeEnd || state.numPages;
              // Grow the render window so the target mounts, then scroll to it.
              setRenderEnd((prev) => Math.max(prev, Math.min(v + PRELOAD, rangeEnd || state.numPages)));
              dispatch({ type: 'SET_PAGE', page: v });
              setTimeout(() => scrollToPage(v), 150);
            }}
            style={{ width: 64, background: 'var(--color-ink-deep)', border: '1px solid var(--color-ink-mid)', color: 'var(--color-white)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
          />
          <span style={{ fontSize: 12, opacity: 0.8 }}>of {rangeEnd || state.numPages}</span>
          {state.searchTerm && (
            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>
              {state.searchResults.length ? `${state.searchResults.length} page(s) contain \"${state.searchTerm}\"` : state.searchScanningPage ? `Scanning p.${state.searchScanningPage}/${state.numPages || '?'}` : 'No matches'}
            </span>
          )}
          <IconButton
            size="small"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
            sx={{
              marginLeft: 'auto',
              color: 'var(--color-white)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </div>
      )}

      {/* Floating highlight palette */}
      {palettePos && (
        <div
          style={{
            position: 'fixed',
            left: palettePos.x,
            top: palettePos.y,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 8px',
            background: 'var(--color-navy-700)',
            border: '1px solid color-mix(in srgb, var(--color-white) 14%, transparent)',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ color: 'var(--color-white)', fontSize: 12, fontWeight: 700, marginRight: 2, letterSpacing: 0.2 }}>Highlight</span>
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Highlight in ${c}`}
              onClick={() => applyHighlight(c)}
              style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,0.45)', cursor: 'pointer', padding: 0 }}
            />
          ))}
          <button
            aria-label="Cancel highlight"
            onClick={() => { setPalettePos(null); setSelectionRects([]); setSelectionText(''); }}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, marginLeft: 2 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function PdfViewer({ url, initialPage, pageRange, onPageCount }) {
  if (!url) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No document selected</div>;
  return (
    <ViewerProvider>
      <InnerViewer url={url} initialPage={initialPage} pageRange={pageRange} onPageCount={onPageCount} />
    </ViewerProvider>
  );
}
