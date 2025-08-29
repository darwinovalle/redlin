import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import { FlashcardProvider } from '../../context/FlashcardContext';
import Flashcard from '../../components/Flashcard/Flashcard';
import DocReview from '../../components/Flashcard/DocReview';
import QuizView from '../../components/Flashcard/QuizView';
import { documentService } from '../../services/api';
import Summary from '../../components/Summary';
import PdfViewer from '../../components/PdfViewer/PdfViewer';
import { useAuth } from '../../context/AuthContext';
import './dashboard.css';

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

const Dashboard = ({ user }) => {
  const [activeTab, setActiveTab] = React.useState(0); 

  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [flashcardsRefreshKey, setFlashcardsRefreshKey] = useState(0);
  const [userDocuments, setUserDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user: authUser } = useAuth();
  const { docSlug } = useParams();

  // Fetch user documents when component mounts
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

  useEffect(() => {
    const fetchUserDocuments = async () => {
      // Only proceed if we have a user
      if (!authUser) {
        return; // Don't attempt to fetch documents if there's no auth user
      }
      
      setIsLoading(true);
      try {
        // Get documents for the current user
        const documents = await documentService.getUserDocuments(authUser.id);
        
        // Update state with the fetched documents
        setUserDocuments(documents);

        // If a slug is present, try to select the matching doc
        let initialId = null;
        if (docSlug && documents?.length) {
          const match = documents.find((d) => slugify(d.title) === docSlug);
          if (match) initialId = match.id;
        }
        // Fallback to first doc if nothing matched
        if (!initialId && documents && documents.length > 0) {
          initialId = documents[0].id;
        }
        if (initialId && selectedDocumentId !== initialId) {
          setSelectedDocumentId(initialId);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        // Don't set any error state for now to prevent UI disruption
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if we have a user
    if (authUser && authUser.id) {
      fetchUserDocuments();
    }
  }, [authUser, selectedDocumentId, docSlug]); // Re-run when auth user, selected doc, or slug changes
  
  const handleDocumentSelect = (id) => {
    setSelectedDocumentId(id);
    // Optionally, switch to the Flashcard tab when a document is selected
    // setActiveTab(0); 
  };

  const handleDeleteDocument = async (documentId) => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      try {
        const result = await documentService.deleteDocument(documentId);
        
        if (result.success) {
          // Update the local state to remove the deleted document
          setUserDocuments(prevDocs => prevDocs.filter(doc => doc.id !== documentId));
          
          // If the deleted document was selected, reset selection
          if (selectedDocumentId === documentId) {
            setSelectedDocumentId(null);
            
            // Optionally select another document if available
            const remainingDocs = userDocuments.filter(doc => doc.id !== documentId);
            if (remainingDocs.length > 0) {
              setSelectedDocumentId(remainingDocs[0].id);
            }
          }
          
          // Success message
          alert('Document deleted successfully');
        } else {
          // Handle failed deletion
          console.error('Delete failed:', result.error);
          alert(`Failed to delete document: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error in delete operation:', error);
        alert('An error occurred while deleting the document. Please try again.');
      }
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleReviewChange = () => {
    // Increment key to force Flashcard component to refetch ordered list
    setFlashcardsRefreshKey((k) => k + 1);
  };

  return (
    <div className="dashboard-root">
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', gap: 0, p: 0, m: 0, height: '100%', overflow: 'hidden' }}>
        {/* PDF Viewer reverted to original styling */}
        <Box sx={{ flex: 1, minWidth: 480, maxWidth: 'calc(100% - 700px)', height: '100%', overflow: 'hidden', borderRight: '1px solid #eee' }}>
          <PdfViewer url={selectedDocumentId ? `${import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000/api'}/documents/${selectedDocumentId}/file/` : null} />
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
              <Tab label="FLASHCARDS" />
              <Tab label="REVIEW" />
              <Tab label="QUIZ" />
              <Tab label="SUMMARY" />
            </Tabs>
            <div className="progress-strip" data-role="progress">
              <div className="progress-text">&nbsp;</div>
              <div className="progress-bar-outer">
                <div className="progress-bar-fill" style={{ '--progress': '0%' }} />
              </div>
              <div className="progress-text">&nbsp;</div>
            </div>
          </div>
          <div className="study-content-scroll">
            <TabPanel value={activeTab} index={0}>
              <FlashcardProvider>
                <Flashcard documentId={selectedDocumentId} refreshKey={flashcardsRefreshKey} />
              </FlashcardProvider>
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <DocReview documentId={selectedDocumentId} onReviewChange={handleReviewChange} />
            </TabPanel>
            <TabPanel value={activeTab} index={2}>
              <QuizView documentId={selectedDocumentId} />
            </TabPanel>
            <TabPanel value={activeTab} index={3}>
              <Summary documentId={selectedDocumentId} />
            </TabPanel>
          </div>
        </div>
      </Box>
    </div>
  );
};

export default Dashboard;