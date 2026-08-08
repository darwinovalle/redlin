import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
// import { FlashcardProvider } from '../../context/FlashcardContext'; // MVP: Flashcards hidden
import { documentService } from '../../services/api';
import { useStudySession } from '../../hooks/useStudySession';
import PdfViewer from '../../components/PdfViewer/PdfViewer';
import { useAuth } from '../../context/AuthContext';
import './dashboard.css';

const SummaryLazy = React.lazy(() => import('../../components/Summary'));
// MVP: Flashcards + Review hidden (see study tabs below)
// const FlashcardLazy = React.lazy(() => import('../../components/Flashcard/Flashcard'));
// const DocReviewLazy = React.lazy(() => import('../../components/Flashcard/DocReview'));
const QuizViewLazy = React.lazy(() => import('../../components/Flashcard/QuizView'));
const ClozePanelLazy = React.lazy(() => import('../../components/Cloze/ClozePanel'));
const FeynmanPanelLazy = React.lazy(() => import('../../components/Feynman/FeynmanPanel'));

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api';

const slugify = (str) =>
  (str || '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      style={{ height: '100%' }} 
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const LoadingPanel = () => (
  <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}>
    Loading...
  </Box>
);

const Dashboard = () => {
  const [activeTab, setActiveTab] = React.useState(0); 

  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docTotal, setDocTotal] = useState(null); // page count reported by the viewer on load
  // const [flashcardsRefreshKey, setFlashcardsRefreshKey] = useState(0); // MVP: Flashcards hidden
  const { user: authUser } = useAuth();
  const { docSlug } = useParams();
  const navigate = useNavigate();

  // Focus Mode: tests open fullscreen so the student can't peek at the summary.
  // Persisted; defaults to ON (same behaviour as Classroom Spaces).
  const [focusMode, setFocusMode] = useState(() => {
    try {
      const stored = localStorage.getItem('study:focusMode');
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });
  const [focusSession, setFocusSession] = useState(null); // 'quiz' | 'cloze' | 'feynman' | null
  const [focusKey, setFocusKey] = useState(0);

  // Auto-record study time for the whole document page (reading the PDF +
  // MCQs/Cloze/Feynman), since the Dashboard doesn't use the shared StudyPanel.
  useStudySession({ model: 'document', itemId: selectedDocumentId });

  useEffect(() => {
    let cancelled = false;

    const fetchUserDocuments = async () => {
      if (!authUser?.id) {
        setSelectedDocumentId(null);
        return;
      }

      try {
        const documents = await documentService.getUserDocuments(authUser.id);
        if (cancelled) return;
        setDocuments(documents);

        let initialId = null;
        if (docSlug && documents?.length) {
          const match = documents.find((d) => slugify(d.title) === docSlug);
          if (match) initialId = match.id;
        }
        if (!initialId && documents && documents.length > 0) {
          initialId = documents[0].id;
        }

        setSelectedDocumentId((previousId) => (
          previousId === initialId ? previousId : (initialId || null)
        ));
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching documents:', error);
      }
    };

    fetchUserDocuments();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, docSlug]);

  const pdfUrl = useMemo(() => {
    if (!selectedDocumentId) return null;
    return `${API_BASE_URL}/documents/${selectedDocumentId}/file/`;
  }, [selectedDocumentId]);

  const handleTabChange = (_event, newValue) => {
    setActiveTab(newValue);
  };

  // Persist the focus-mode preference across reloads.
  useEffect(() => {
    try { localStorage.setItem('study:focusMode', focusMode ? '1' : '0'); } catch {}
  }, [focusMode]);

  const openFocus = (type) => { setFocusKey((k) => k + 1); setFocusSession(type); };

  const selectedDoc = documents.find((d) => d.id === selectedDocumentId);
  const studyTitle = selectedDoc?.title || 'Study Document';

  // const handleReviewChange = () => { // MVP: Review hidden
  //   setFlashcardsRefreshKey((k) => k + 1);
  // };

  return (
    <div className="dashboard-root">
      {/* Return hero header — back to the /documents directory */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 2, borderBottom: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)', background: 'var(--color-navy-deep)' }}>
        <IconButton
          onClick={() => navigate('/documents')}
          size="small"
          aria-label="Back to documents"
          title="Back to documents"
          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ color: 'var(--color-white)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {studyTitle}
          </Typography>
          {docTotal != null && docTotal > 0 && (
            <Typography variant="caption" sx={{ color: 'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>
              {docTotal} pages
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', gap: 0, p: 0, m: 0, overflow: 'hidden' }}>
        {/* PDF Viewer reverted to original styling */}
        <Box sx={{ flex: 1, minWidth: 480, maxWidth: 'calc(100% - 700px)', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--color-divider-soft)' }}>
          <PdfViewer url={pdfUrl} onPageCount={setDocTotal} />
        </Box>
        {/* Study / Flashcard Panel retains new style */}
        <div className="study-panel" style={{ width: 700 }}>
          <div className="study-header">
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="study tabs"
              variant="scrollable"
              allowScrollButtonsMobile
              className="dashboard-tabs"
            >
              <Tab label="SUMMARY" />
              {/* MVP: Flashcards + Review hidden */}
              {/* <Tab label="FLASHCARDS" /> */}
              {/* <Tab label="REVIEW" /> */}
              <Tab label="MCQS" />
              <Tab label="CLOZE" />
              <Tab label="FEYNMAN" />
            </Tabs>
            <div className="study-divider" aria-hidden="true" />
          </div>
          <div className="study-content-scroll">
            <TabPanel value={activeTab} index={0}>
              <React.Suspense fallback={<LoadingPanel />}>
                <SummaryLazy documentId={selectedDocumentId} title={studyTitle} />
              </React.Suspense>
            </TabPanel>
            {/* MVP: Flashcards + Review hidden */}
            {/* <TabPanel value={activeTab} index={1}>
              <React.Suspense fallback={<LoadingPanel />}>
                <FlashcardProvider>
                  <FlashcardLazy documentId={selectedDocumentId} refreshKey={flashcardsRefreshKey} />
                </FlashcardProvider>
              </React.Suspense>
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <React.Suspense fallback={<LoadingPanel />}>
                <DocReviewLazy documentId={selectedDocumentId} onReviewChange={handleReviewChange} />
              </React.Suspense>
            </TabPanel> */}
            <TabPanel value={activeTab} index={1}>
              <React.Suspense fallback={<LoadingPanel />}>
                <QuizViewLazy documentId={selectedDocumentId} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('quiz')} />
              </React.Suspense>
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <React.Suspense fallback={<LoadingPanel />}>
                <ClozePanelLazy documentId={selectedDocumentId} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('cloze')} />
              </React.Suspense>
            </TabPanel>
            <TabPanel value={activeTab} index={3}>
              {/* Feynman Panel */}
              {selectedDocumentId && (
                <React.Suspense fallback={<LoadingPanel />}>
                  <FeynmanPanelLazy documentId={selectedDocumentId} focus={focusMode} onFocusChange={setFocusMode} onStart={() => openFocus('feynman')} />
                </React.Suspense>
              )}
            </TabPanel>
          </div>
        </div>
      </Box>

      {/* Focus Mode dialog: opens the selected test fullscreen with a blurred backdrop */}
      <Dialog
        open={Boolean(focusSession)}
        onClose={() => setFocusSession(null)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          style: { backgroundColor: '#1A2A3A' },
          sx: {
            borderRadius: '20px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxHeight: '92vh',
            overflow: 'hidden',
          },
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'color-mix(in srgb, var(--color-navy-deep) 74%, transparent)',
              backdropFilter: 'blur(10px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LockIcon sx={{ color: 'var(--color-teal)', fontSize: 18 }} />
            <Typography sx={{ color: 'var(--color-white)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Focus Mode · {focusSession === 'quiz' ? 'MCQs' : focusSession === 'cloze' ? 'Cloze' : 'Feynman'}
            </Typography>
          </Stack>
          <IconButton onClick={() => setFocusSession(null)} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: { xs: 1.5, sm: 3 }, overflowY: 'auto' }}>
          {focusSession === 'quiz' && <QuizViewLazy key={focusKey} documentId={selectedDocumentId} autoStart onExit={() => setFocusSession(null)} />}
          {focusSession === 'cloze' && <ClozePanelLazy key={focusKey} documentId={selectedDocumentId} autoStart />}
          {focusSession === 'feynman' && selectedDocumentId && (
            <FeynmanPanelLazy key={focusKey} documentId={selectedDocumentId} autoStart />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;