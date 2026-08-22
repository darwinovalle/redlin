import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PdfViewer from '../../components/PdfViewer/PdfViewer';
import StudyPanel from '../../components/Study/StudyPanel';
import StudyTimerBadge from '../../components/common/StudyTimerBadge';
import { useStudySession } from '../../hooks/useStudySession';
import { documentService } from '../../services/api';

const BookChapterStudy = () => {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Auto-record study time while the chapter stays open (Summary tab only) and
  // drive the live counter in the page header — same placement as the Documents timer.
  const studyElapsed = useStudySession({ model: 'document', itemId: chapter?.id, active: activeTab === 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const chapters = await documentService.getBookChapters(bookId);
        const ch = chapters.find((c) => String(c.id) === String(chapterId));
        if (!cancelled) setChapter(ch || null);
      } catch (e) {
        console.error('Load chapter failed:', e);
        if (!cancelled) setChapter(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, chapterId]);

  const pdfUrl = chapter ? documentService.getPdfUrl(chapter.id) : null;

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-navy-deep)', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <IconButton
          onClick={() => navigate(`/books/${bookId}`)}
          size="small"
          aria-label="Back to book"
          title="Back to book"
          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chapter?.title || 'Chapter'}
          </Typography>
          {chapter?.page_start && (
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
              Pages {chapter.page_start}–{chapter.page_end || 'end'}
            </Typography>
          )}
        </Box>
        <Box sx={{ ml: 'auto' }}><StudyTimerBadge seconds={studyElapsed} /></Box>
      </Box>

      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: 'var(--color-teal)' }} />
        </Box>
      ) : !chapter ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: 'color-mix(in srgb, var(--color-white) 72%, transparent)' }}>Chapter not found.</Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Box sx={{ flex: 1, minWidth: 480, maxWidth: 'calc(100% - 700px)', height: '100%', overflow: 'hidden', borderRight: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
            <PdfViewer
              url={pdfUrl}
              initialPage={chapter.page_start}
              pageRange={chapter.page_start ? [chapter.page_start, chapter.page_end || null] : null}
            />
          </Box>
          <Box sx={{ width: 700, flexShrink: 0, borderLeft: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' }}>
            <StudyPanel documentId={chapter.id} title={chapter.title} activeTab={activeTab} onTabChange={setActiveTab} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default BookChapterStudy;
