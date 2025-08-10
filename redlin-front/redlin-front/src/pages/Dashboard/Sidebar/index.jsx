import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import MenuIcon from '@mui/icons-material/Menu';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';

import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '../../../theme';

import { useRef, useState, useEffect } from 'react'; 
import { useAuth } from '../../../context/AuthContext';
import { documentService } from '../../../services/api';

const drawerWidth = 240;

const Drawer = styled(MuiDrawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: 'none',
  },
}));

export default function MiniDrawer({ selectedDocumentId, onDocumentSelect, onDocumentDelete, onLogout }) {
  const theme = useTheme();
  const { user } = useAuth(); 

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const [userDocuments, setUserDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const handleAddContent = () => {
    fileInputRef.current.click(); // Trigger the hidden file input
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return; // No file selected
    }

    const currentUserId = user ? user.id : null;
    if (!currentUserId) {
        setError('User not logged in. Cannot upload document.');
        console.error('Upload failed: User not logged in.');
        return; 
    }

    setError(null);
    setUploading(true);

    try {
      const result = await documentService.uploadDocument(file, currentUserId);
      console.log('Upload successful:', result);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      if (user && user.id) { // Check if user and user.id exist
        setLoadingDocs(true);
        setFetchError(null);
        setUserDocuments([]); // Clear previous documents
        try {
          // Call the service function to get documents for the user
          const documents = await documentService.getUserDocuments(user.id);
          setUserDocuments(documents);
        } catch (err) {
          console.error('Failed to fetch documents:', err);
          setFetchError(err.message || 'Could not load documents.'); // Use err.message
        } finally {
          setLoadingDocs(false);
        }
      } else {
        // Clear documents if user logs out or isn't loaded yet
        setUserDocuments([]);
        setLoadingDocs(false); // Ensure loading is false if no user
        setFetchError(null); // Clear errors if no user
      }
    };

    fetchDocuments();
  }, [user]); // Re-run effect when the user object changes

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Drawer variant="permanent">
          <Box sx={{ p: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              fullWidth
              onClick={handleAddContent}
              sx={{
                color: 'common.white', 
                justifyContent: 'flex-start',
                textTransform: 'none',
                backgroundColor: theme.palette.grey[800],
                '&:hover': {
                  backgroundColor: theme.palette.grey[700],
                },
              }}
            >
              Add content
            </Button>
          </Box>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }} 
            accept=".pdf" 
          />
          {uploading && <Typography sx={{p: 2, color: 'text.secondary'}}>Uploading...</Typography>}
          {error && <Typography sx={{p: 2, color: 'error.main'}}>Error: {error}</Typography>}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <HistoryIcon />
                </ListItemIcon>
                <ListItemText primary="History" />
              </ListItemButton>
            </ListItem>
          </List>
          <Box sx={{ px: 2, mt: 2, mb: 1 }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              My Documents
            </Typography>
          </Box>
          {loadingDocs && <Typography sx={{ px: 2, color: 'text.secondary' }}>Loading documents...</Typography>}
          {fetchError && <Typography sx={{ px: 2, color: 'error.main' }}>Error: {fetchError}</Typography>}
          {!loadingDocs && !fetchError && userDocuments.length === 0 && user && (
            <Typography sx={{ px: 2, color: 'text.secondary', fontStyle: 'italic' }}>No documents uploaded yet.</Typography>
          )}
          <List dense>
            {userDocuments.map((doc) => (
              <ListItem 
                key={doc.id} 
                disablePadding 
                sx={{ 
                  position: 'relative',
                  '&:hover .delete-button': {
                    opacity: 1,
                  }
                }}
              >
                <ListItemButton 
                  onClick={() => onDocumentSelect(doc.id)}
                  selected={selectedDocumentId === doc.id} // Highlight if selected
                  sx={{
                    '&.Mui-selected': { // Style for selected item
                      backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                    },
                    '&.Mui-selected:hover': { // Style for selected item on hover
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                    <InsertDriveFileIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={doc.title}
                    primaryTypographyProps={{
                      style: {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }
                    }}
                  />
                  <IconButton 
                    className="delete-button"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent the ListItemButton click
                      onDocumentDelete(doc.id);
                    }}
                    sx={{ 
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      color: theme.palette.text.secondary
                    }}
                    aria-label="delete document"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Box sx={{ flexGrow: 1 }} /> 
          
          {/* Logout button at the bottom */}
          <Divider />
          <List dense>
            <ListItem disablePadding>
              <ListItemButton onClick={onLogout}>
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>
      </Box>
    </ThemeProvider>
  );
}
