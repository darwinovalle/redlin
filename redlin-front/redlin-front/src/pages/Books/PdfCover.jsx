import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Session cache of cover object URLs (keyed by document id) so revisiting /books
// never re-fetches the cover. Object URLs live for the lifetime of the page.
const coverCache = new Map();

// Renders the first page of a book's PDF as the card cover, over a black
// background so the page edges blend into the card. The cover is served by the
// backend as a small JPEG (`/documents/{id}/cover/`), so a card loads a few KB
// instead of the frontend downloading the whole PDF. Covers fetch lazily (once
// their card is near the viewport). If the image can't be loaded, `fallbackTitle`
// shows on the black background so the card is never empty.
const PdfCover = ({ url, fallbackTitle = '' }) => {
  const rootRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState(() => coverCache.get(url) || null);

  // Lazy load: don't fetch the cover until the card scrolls near.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setVisible(true); io.disconnect(); }
      });
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // New URL → start clean; reuse a cached object URL if we have one.
    const hit = coverCache.get(url);
    if (hit) { setFailed(false); setSrc(hit); return; }
    setFailed(false);
    setSrc(null);
    if (!visible || !url) return;

    let cancelled = false;
    (async () => {
      try {
        let access = null;
        try { access = JSON.parse(localStorage.getItem('auth') || '{}').access; } catch {}
        const res = await fetch(url, { headers: access ? { Authorization: `Bearer ${access}` } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        coverCache.set(url, objectUrl);
        setSrc(objectUrl);
      } catch (e) {
        console.error('Book cover fetch failed', url, e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [url, visible]);

  if (src) {
    return (
      <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#000', pointerEvents: 'none' }}>
        <img src={src} alt="" style={{ display: 'block', maxWidth: '100%' }} />
      </Box>
    );
  }

  if (failed) {
    return (
      <Box ref={rootRef} sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', p: 2.5 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            lineHeight: 1.12,
            color: '#fff',
            textShadow: '0 1px 12px color-mix(in srgb, var(--color-black) 45%, transparent)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {fallbackTitle}
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={rootRef} sx={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#000', pointerEvents: 'none' }} />
  );
};

export default PdfCover;