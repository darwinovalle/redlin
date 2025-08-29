import React, { useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ViewerProvider, useViewer } from './ViewerContext';
import PdfToolbar from './PdfToolbar';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function InnerViewer({ url }) {
  const { state, dispatch } = useViewer();
  const pdfRef = useRef(null);
  const searchJobRef = useRef(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <PdfToolbar />
      <div style={{ flex: 1, overflow: 'auto', background: '#2c2c2c', display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: 12 }}>
          <Document file={fileObj} onLoadSuccess={onLoadSuccess} loading={<div style={{ padding: 12, color: '#fff' }}>Loading PDF…</div>}>
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
        </div>
      </div>
      {state.numPages > 0 && (
        <div style={{ background: 'linear-gradient(90deg,#111,#1e1e1e)', color: '#fff', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13, borderTop: '1px solid #222' }}>
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
            style={{ width: 64, background: '#141414', border: '1px solid #2d2d2d', color: '#fff', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
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
        background: disabled ? '#2a2a2a' : '#20C997',
        border: '1px solid ' + (disabled ? '#2a2a2a' : '#16a57b'),
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 18,
        lineHeight: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        boxShadow: disabled ? 'none' : '0 2px 6px rgba(0,0,0,0.4)',
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
