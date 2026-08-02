import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
// import { FlashcardProvider } from '../../context/FlashcardContext'; // MVP: Flashcards hidden
import { documentService } from '../../services/api';
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
  // const [flashcardsRefreshKey, setFlashcardsRefreshKey] = useState(0); // MVP: Flashcards hidden
  const { user: authUser } = useAuth();
  const { docSlug } = useParams();

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

  // const handleReviewChange = () => { // MVP: Review hidden
  //   setFlashcardsRefreshKey((k) => k + 1);
  // };

  return (
    <div className="dashboard-root">
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', gap: 0, p: 0, m: 0, height: '100%', overflow: 'hidden' }}>
        {/* PDF Viewer reverted to original styling */}
        <Box sx={{ flex: 1, minWidth: 480, maxWidth: 'calc(100% - 700px)', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--color-divider-soft)' }}>
          <PdfViewer url={pdfUrl} />
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
              <Tab label="QUIZ" />
              <Tab label="CLOZE" />
              <Tab label="FEYNMAN" />
            </Tabs>
            <div className="study-divider" aria-hidden="true" />
          </div>
          <div className="study-content-scroll">
            <TabPanel value={activeTab} index={0}>
              <React.Suspense fallback={<LoadingPanel />}>
                <SummaryLazy documentId={selectedDocumentId} />
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
                <QuizViewLazy documentId={selectedDocumentId} />
              </React.Suspense>
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <React.Suspense fallback={<LoadingPanel />}>
                <ClozePanelLazy documentId={selectedDocumentId} />
              </React.Suspense>
            </TabPanel>
            <TabPanel value={activeTab} index={3}>
              {/* Feynman Panel */}
              {selectedDocumentId && (
                <React.Suspense fallback={<LoadingPanel />}>
                  <FeynmanPanelLazy documentId={selectedDocumentId} />
                </React.Suspense>
              )}
            </TabPanel>
          </div>
        </div>
      </Box>
    </div>
  );
};

export default Dashboard;