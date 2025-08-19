import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// Import a local worker URL from pdfjs-dist to avoid CORS issues
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ViewerProvider, useViewer } from './ViewerContext';
import PdfToolbar from './PdfToolbar';

// Configure pdfjs worker from local bundle to avoid CDN/CORS
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

function InnerViewer({ url }) {
  const { state, dispatch } = useViewer();
  const [highlights, setHighlights] = useState([]); // { id, page, rects:[{x,y,w,h}], color, text }

  const onLoadSuccess = (pdf) => {
    dispatch({ type: 'SET_NUM_PAGES', numPages: pdf.numPages });
  };

  const pages = useMemo(() => Array.from({ length: state.numPages || 0 }, (_, i) => i + 1), [state.numPages]);

  const fileObj = useMemo(() => {
    if (!url) return null;
    let access = null;
    try { access = JSON.parse(localStorage.getItem('auth') || '{}').access; } catch {}
    return access ? { url, httpHeaders: { Authorization: `Bearer ${access}` } } : { url };
  }, [url]);

  const onMouseUp = useCallback((pageNumber, containerEl) => {
    if (!state.highlightMode || !containerEl) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const rectList = Array.from(range.getClientRects());
    if (!rectList.length) return;
    const bbox = containerEl.getBoundingClientRect();
    const normRects = rectList.map(r => ({
      x: (r.left - bbox.left) / bbox.width,
      y: (r.top - bbox.top) / bbox.height,
      w: r.width / bbox.width,
      h: r.height / bbox.height,
    }));
    const text = sel.toString();
    sel.removeAllRanges();
    setHighlights((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, page: pageNumber, rects: normRects, color: 'rgba(255,235,59,0.55)', text }
    ]);
  }, [state.highlightMode]);

  function PageView({ pageNumber }) {
    const ref = useRef(null);
    return (
      <div
        key={pageNumber}
        ref={ref}
        onMouseUp={() => onMouseUp(pageNumber, ref.current)}
        style={{ position: 'relative', margin: 0 }}
      >
        <Page pageNumber={pageNumber} scale={state.scale} renderTextLayer renderAnnotationLayer />
        {/* Highlight overlay */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {highlights.filter(h => h.page === pageNumber).map(h => (
            h.rects.map((r, idx) => (
              <div key={`${h.id}-${idx}`} style={{
                position: 'absolute',
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: h.color,
                borderRadius: 2,
              }} />
            ))
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <PdfToolbar />
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Document file={fileObj} onLoadSuccess={onLoadSuccess} loading={<div style={{ padding: 12 }}>Loading PDF…</div>}>
            {pages.map((p) => (
              <PageView key={p} pageNumber={p} />
            ))}
          </Document>
        </div>
      </div>
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
