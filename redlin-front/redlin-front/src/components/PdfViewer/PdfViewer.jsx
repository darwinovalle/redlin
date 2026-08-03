import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// Continuous scroll: every page is rendered stacked so scrolling flows
// naturally from one page to the next (no page remount / blink).
function InnerViewer({ url }) {
  const { state, dispatch } = useViewer();
  const pdfRef = useRef(null);
  const searchJobRef = useRef(null);
  const scrollRef = useRef(null);
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

  // Which page is most in view, based on the scroll position.
  const updateCurrentPageFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('.react-pdf__Page');
    if (!pages.length) return;
    const containerTop = el.getBoundingClientRect().top;
    const threshold = el.clientHeight * 0.35;
    let current = 1;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].getBoundingClientRect().top - containerTop < threshold) current = i + 1;
      else break;
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
    if (state.searchResults.length) {
      const target = state.searchResults[state.currentSearchIndex];
      if (target && target !== navStateRef.current.page) scrollToPage(target);
    }
  }, [state.searchResults, state.currentSearchIndex, scrollToPage]);

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

  const pageNumbers = state.numPages > 0 ? Array.from({ length: state.numPages }, (_, i) => i + 1) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <PdfToolbar />
      <div
        ref={scrollRef}
        onMouseUp={handleMouseUp}
        style={{ flex: 1, overflow: 'auto', background: 'var(--color-ink-soft)', display: 'flex', justifyContent: 'center' }}
      >
        <div style={{ padding: '12px 12px 48px', width: 'max-content' }}>
          <Document file={fileObj} onLoadSuccess={onLoadSuccess} loading={<div style={{ padding: 12, color: 'var(--color-white)' }}>Loading PDF…</div>}>
            {pageNumbers.map((p) => (
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
          </Document>
        </div>
      </div>
      {state.numPages > 0 && (
        <div style={{ background: 'linear-gradient(90deg,var(--color-text-deep),var(--color-ink-surface))', color: 'var(--color-white)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13, borderTop: '1px solid var(--color-text-strong)' }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Page</span>
          <input
            type="number"
            value={state.page}
            onChange={(e) => {
              let v = parseInt(e.target.value, 10) || 1;
              if (v < 1) v = 1; if (v > state.numPages) v = state.numPages;
              dispatch({ type: 'SET_PAGE', page: v });
              scrollToPage(v);
            }}
            style={{ width: 64, background: 'var(--color-ink-deep)', border: '1px solid var(--color-ink-mid)', color: 'var(--color-white)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
          />
          <span style={{ fontSize: 12, opacity: 0.8 }}>of {state.numPages}</span>
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

export default function PdfViewer({ url }) {
  if (!url) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No document selected</div>;
  return (
    <ViewerProvider>
      <InnerViewer url={url} />
    </ViewerProvider>
  );
}
