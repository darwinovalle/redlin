import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
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

function InnerViewer({ url }) {
  const { state, dispatch } = useViewer();
  const pdfRef = useRef(null);
  const searchJobRef = useRef(null);
  const pageWrapRef = useRef(null);
  const scrollRef = useRef(null);

  // Text highlights (persisted to the backend per user + document).
  const [highlights, setHighlights] = useState([]);
  const [palettePos, setPalettePos] = useState(null);
  const [selectionRects, setSelectionRects] = useState([]);
  const [selectionText, setSelectionText] = useState('');
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });

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

  // Track the rendered page box so highlight overlays position correctly at any zoom.
  useLayoutEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return undefined;
    const update = () => setPageSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.page, state.scale]);

  // Hide the floating palette while the page scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => setPalettePos(null);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setPalettePos(null);
      return;
    }
    const pageEl = pageWrapRef.current?.querySelector('.react-pdf__Page');
    if (!pageEl || !pageEl.contains(sel.anchorNode) || !pageEl.contains(sel.focusNode)) {
      setPalettePos(null);
      return;
    }
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
    } catch {
      setPalettePos(null);
    }
  }, []);

  const applyHighlight = useCallback(async (color) => {
    const docId = getDocId(url);
    if (!docId || !selectionRects.length) return;
    try {
      const created = await documentService.createHighlight(docId, {
        page: state.page,
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
  }, [url, selectionRects, selectionText, state.page]);

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
    (async () => {
      for (let p = 1; p <= pdf.numPages; p++) {
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
  }, [state.searchTerm]);

  // Move to selected search result page
  useEffect(() => {
    if (state.searchResults.length) {
      const target = state.searchResults[state.currentSearchIndex];
      if (target !== state.page) dispatch({ type: 'SET_PAGE', page: target });
    }
  }, [state.searchResults, state.currentSearchIndex]);

  const pageHighlights = highlights.filter((h) => h.page === state.page);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <PdfToolbar />
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: 'var(--color-ink-soft)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: 12 }}>
          <div ref={pageWrapRef} style={{ position: 'relative', width: 'max-content' }} onMouseUp={handleMouseUp}>
            <Document file={fileObj} onLoadSuccess={onLoadSuccess} loading={<div style={{ padding: 12, color: 'var(--color-white)' }}>Loading PDF…</div>}>
              {state.numPages > 0 && (
                <Page
                  key={state.page + '-' + state.scale}
                  pageNumber={state.page}
                  scale={state.scale}
                  renderTextLayer
                  renderAnnotationLayer
                />
              )}
            </Document>
            {pageSize.w > 0 && pageHighlights.map((h) => h.rects.map((r, idx) => (
              <div
                key={`${h.id}-${idx}`}
                role="button"
                aria-label="Remove highlight"
                title="Remove highlight"
                onClick={(e) => { e.stopPropagation(); removeHighlight(h.id); }}
                style={{
                  position: 'absolute',
                  left: r.x * pageSize.w,
                  top: r.y * pageSize.h,
                  width: r.w * pageSize.w,
                  height: r.h * pageSize.h,
                  backgroundColor: hexToRgba(h.color, 0.45),
                  borderRadius: 2,
                  cursor: 'pointer',
                  zIndex: 3,
                }}
              />
            )))}
          </div>
        </div>
      </div>
      {state.numPages > 0 && (
        <div style={{ background: 'linear-gradient(90deg,var(--color-text-deep),var(--color-ink-surface))', color: 'var(--color-white)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13, borderTop: '1px solid var(--color-text-strong)' }}>
          <PagerBtn ariaLabel="Previous page" disabled={state.page <= 1} onClick={() => dispatch({ type: 'SET_PAGE', page: Math.max(1, state.page - 1) })}>‹</PagerBtn>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Page</span>
          <input
            type="number"
            value={state.page}
            onChange={(e) => {
              let v = parseInt(e.target.value, 10) || 1;
              if (v < 1) v = 1; if (v > state.numPages) v = state.numPages;
              dispatch({ type: 'SET_PAGE', page: v });
            }}
            style={{ width: 64, background: 'var(--color-ink-deep)', border: '1px solid var(--color-ink-mid)', color: 'var(--color-white)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
          />
          <span style={{ fontSize: 12, opacity: 0.8 }}>of {state.numPages}</span>
          <PagerBtn ariaLabel="Next page" disabled={state.page >= state.numPages} onClick={() => dispatch({ type: 'SET_PAGE', page: Math.min(state.numPages, state.page + 1) })}>›</PagerBtn>
          {state.searchTerm && (
            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.75 }}>
              {state.searchResults.length ? `${state.searchResults.length} page(s) contain \"${state.searchTerm}\"` : state.searchScanningPage ? `Scanning p.${state.searchScanningPage}/${state.numPages || '?'}` : 'No matches'}
            </span>
          )}
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

function PagerBtn({ children, onClick, disabled, ariaLabel }) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 36,
        height: 32,
        borderRadius: 8,
        background: disabled ? 'var(--color-ink)' : 'var(--color-teal)',
        border: '1px solid ' + (disabled ? 'var(--color-ink)' : 'var(--color-teal-bright)'),
        color: 'var(--color-white)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 18,
        lineHeight: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        boxShadow: disabled ? 'none' : '0 2px 6px color-mix(in srgb, var(--color-black) 40%, transparent)',
        transition: 'background .15s, transform .15s'
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(1px)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >{children}</button>
  );
}

export default function PdfViewer({ url }) {
  if (!url) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No document selected</div>;
  return (
    <ViewerProvider>
      <InnerViewer url={url} />
    </ViewerProvider>
  );
}
