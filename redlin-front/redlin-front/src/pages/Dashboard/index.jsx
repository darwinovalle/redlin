import * as React from 'react'; 
import { useState, useEffect } from 'react';
import { Navigate } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import MiniDrawer from "./Sidebar";
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs'; 
import Tab from '@mui/material/Tab';   
import Typography from '@mui/material/Typography'; 
import { FlashcardProvider } from '../../context/FlashcardContext';
import Flashcard from '../../components/Flashcard/Flashcard';
import QuizView from '../../components/Flashcard/QuizView';
import { documentService } from '../../services/api';
import Summary from '../../components/Summary';
import { useAuth } from '../../context/AuthContext';
import WavyBackground from '../../components/common/WavyBackground';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)', overflowY: 'auto' }} 
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Dashboard = ({ user }) => {
  const [activeTab, setActiveTab] = React.useState(0); 

  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [userDocuments, setUserDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  // Fetch user documents when component mounts
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
        
        // If documents exist and nothing is selected, select the first one
        if (documents && documents.length > 0 && !selectedDocumentId) {
          setSelectedDocumentId(documents[0].id);
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
  }, [authUser, selectedDocumentId]); // Re-run when auth user or selected document changes
  
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

  const handleLogout = () => {
    logout(); // Call the logout function from AuthContext
    navigate('/'); // Navigate to login page (assuming '/' is your login route)
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: '100vh', bgcolor: 'transparent' }}>
  <WavyBackground waveHeight="60vh" offsetY={0} />
      <MiniDrawer 
        selectedDocumentId={selectedDocumentId}
        onDocumentSelect={handleDocumentSelect}
        onDocumentDelete={handleDeleteDocument}
        onLogout={handleLogout}
      />
      {/* Wrapper Box to handle spacing from sidebar and enable centering */}
      <Box sx={{ position: 'relative', zIndex: 1, flexGrow: 1, pl: '0px', /* Removed padding to shift fully left for centering */ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', pt: 2 }}>
        {/* Centered Content Box */}
        <Box sx={{ width: '100%', maxWidth: '1000px', /* Max width for centered content */ display: 'flex', flexDirection: 'column', height: '100%', backdropFilter: 'none' }}>
          {/* Tabs as Header - Centered within the 'Centered Content Box' */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%', flexShrink: 0 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange} 
              aria-label="main content tabs" 
              centered
              textColor="inherit"
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: '#ffffff',
                },
              }}
            > 
              <Tab 
                label="Flashcards" 
                sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }}
              />
              <Tab 
                label="Quiz" 
                sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }}
              />
              <Tab 
                label="Summary" 
                sx={{ fontWeight: 900, color: '#000000', '&.Mui-selected': { color: '#fff' } }}
              />
            </Tabs>
          </Box>

          {/* Single Main Content Area Below Tabs - Also centered */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* TabPanel content based on activeTab */}
            {/* Apply height 100% to TabPanel if its content needs to fill vertically */}
            <TabPanel value={activeTab} index={0} sx={{ p: 0, flexGrow: 1 }}>
              <FlashcardProvider>
                <Flashcard documentId={selectedDocumentId} /> 
              </FlashcardProvider>
            </TabPanel>
            <TabPanel value={activeTab} index={1} sx={{ p: 0, flexGrow: 1 }}>
              <QuizView documentId={selectedDocumentId} />
            </TabPanel>
            <TabPanel value={activeTab} index={2} sx={{ p: 0, flexGrow: 1 }}>
              <Summary documentId={selectedDocumentId} />
            </TabPanel>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;