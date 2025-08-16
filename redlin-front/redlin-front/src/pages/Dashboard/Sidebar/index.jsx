import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
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
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import BarChartIcon from '@mui/icons-material/BarChart';
import HomeIcon from '@mui/icons-material/Home';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import EditIcon from '@mui/icons-material/Edit';

import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '../../../theme';

import { useRef, useState, useEffect } from 'react'; 
import { useAuth } from '../../../context/AuthContext';
import { documentService } from '../../../services/api';
import AddSpaceModal from '../../../components/common/AddSpaceModal';
import { csvService } from '../../../services/api/csv';
import LoaderOverlay from '../../../components/common/LoaderOverlay';
import SuccessAlert from '../../../components/common/SuccessAlert';
import RenameDialog from '../../../components/common/RenameDialog';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 350;

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

export default function MiniDrawer({ selectedDocumentId, onDocumentSelect, onDocumentDelete, onLogout, onOpenSettings, onUpgradeToPro }) {
  // ...existing code...
  const [loading, setLoading] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);
  const theme = useTheme();
  const { user } = useAuth(); 
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname.startsWith('/home');
  const currentDocSlug = React.useMemo(() => {
    const m = location.pathname.match(/^\/documents\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [location.pathname]);
  const currentCsvSlug = React.useMemo(() => {
    const m = location.pathname.match(/^\/csv\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [location.pathname]);
  const docsOpenKey = React.useMemo(() => (user?.id ? `sidebar:${user.id}:docsOpen` : null), [user?.id]);
  const sheetsOpenKey = React.useMemo(() => (user?.id ? `sidebar:${user.id}:sheetsOpen` : null), [user?.id]);
  const kanbanOpenKey = React.useMemo(() => (user?.id ? `sidebar:${user.id}:kanbanOpen` : null), [user?.id]);
  const statsOpenKey = React.useMemo(() => (user?.id ? `sidebar:${user.id}:statsOpen` : null), [user?.id]);

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const [userDocuments, setUserDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [docsOpen, setDocsOpen] = useState(() => {
    if (docsOpenKey) {
      try {
        const v = localStorage.getItem(docsOpenKey);
        if (v === 'true' || v === 'false') return v === 'true';
      } catch {}
    }
    // Default when no persisted value: collapsed on Home, expanded elsewhere
    return !isHome;
  });
  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(() => {
    if (sheetsOpenKey) {
      try {
        const v = localStorage.getItem(sheetsOpenKey);
        if (v === 'true' || v === 'false') return v === 'true';
      } catch {}
    }
    return false;
  });
  const [csvImports, setCsvImports] = useState([]);
  const [kanbanOpen, setKanbanOpen] = useState(() => {
    if (kanbanOpenKey) {
      try {
        const v = localStorage.getItem(kanbanOpenKey);
        if (v === 'true' || v === 'false') return v === 'true';
      } catch {}
    }
    return false;
  });
  const [statsOpen, setStatsOpen] = useState(() => {
    if (statsOpenKey) {
      try {
        const v = localStorage.getItem(statsOpenKey);
        if (v === 'true' || v === 'false') return v === 'true';
      } catch {}
    }
    return false;
  });
  const [openSampleModal, setOpenSampleModal] = useState(false);
  const [renameState, setRenameState] = useState({ open: false, doc: null, saving: false });
  const [renameSheetState, setRenameSheetState] = useState({ open: false, imp: null, saving: false });
  
  // Helper to fetch docs so we can reuse after uploads
  const fetchUserDocuments = async () => {
    if (user && user.id) { // Check if user and user.id exist
      setLoadingDocs(true);
      setFetchError(null);
      setUserDocuments([]); // Clear previous documents
      try {
        const documents = await documentService.getUserDocuments(user.id);
        setUserDocuments(documents);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
        setFetchError(err.message || 'Could not load documents.');
      } finally {
        setLoadingDocs(false);
      }
    } else {
      setUserDocuments([]);
      setLoadingDocs(false);
      setFetchError(null);
    }
  };

  const handleAddContent = () => {
    fileInputRef.current.click(); // Trigger the hidden file input
  };

  const uploadFile = async (file) => {
    if (!file) return;
    const currentUserId = user ? user.id : null;
    if (!currentUserId) {
      setError('User not logged in. Cannot upload document.');
      console.error('Upload failed: User not logged in.');
      return;
    }
    setError(null);
    setLoading(true);
    setUploading(true);
    try {
      const result = await documentService.uploadDocument(file, currentUserId);
      console.log('Upload successful:', result);
      await fetchUserDocuments();
      setSuccessAlertOpen(true);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    await uploadFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (onDocumentDelete) { onDocumentDelete(doc.id); return; }
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;
    try {
      await documentService.deleteDocument(doc.id);
      const remaining = userDocuments.filter((d) => d.id !== doc.id);
      setUserDocuments(remaining);
      // If we were on this doc page, redirect to next available or home
      if (currentDocSlug && slugify(doc.title || String(doc.id)) === currentDocSlug) {
        if (remaining.length > 0) {
          const nextSlug = slugify(remaining[0].title || String(remaining[0].id));
          navigate(`/documents/${nextSlug}`);
        } else {
          navigate('/home');
        }
      }
    } catch (e) {
      console.error('Delete failed', e);
      alert('Failed to delete document');
    }
  };

  const handleDeleteSheet = async (imp) => {
    if (!window.confirm('Delete this sheet and its flashcards? This action cannot be undone.')) return;
    try {
      await csvService.deleteImport(imp.id);
      const remaining = csvImports.filter((i) => i.id !== imp.id);
      setCsvImports(remaining);
      const deletedName = (imp.filename || 'csv').replace(/\.[^/.]+$/, '');
      const deletedSlug = slugify(deletedName);
      if (currentCsvSlug && deletedSlug === currentCsvSlug) {
        if (remaining.length > 0) {
          const nextName = (remaining[0].filename || 'csv').replace(/\.[^/.]+$/, '');
          const nextSlug = slugify(nextName);
          navigate(`/csv/${nextSlug}?importId=${remaining[0].id}`);
        } else {
          navigate('/home');
        }
      }
    } catch (e) {
      console.error('Delete sheet failed', e);
      alert('Failed to delete sheet');
    }
  };

  // Load persisted docsOpen when user changes (and a key becomes available)
  useEffect(() => {
    if (!docsOpenKey) return;
    try {
      const v = localStorage.getItem(docsOpenKey);
      if (v === 'true' || v === 'false') setDocsOpen(v === 'true');
    } catch {}
  }, [docsOpenKey]);

  // Persist docsOpen whenever it changes
  useEffect(() => {
    if (!docsOpenKey) return;
    try { localStorage.setItem(docsOpenKey, String(docsOpen)); } catch {}
  }, [docsOpen, docsOpenKey]);

  // Load persisted sheetsOpen when user changes
  useEffect(() => {
    if (!sheetsOpenKey) return;
    try {
      const v = localStorage.getItem(sheetsOpenKey);
      if (v === 'true' || v === 'false') setSheetsOpen(v === 'true');
    } catch {}
  }, [sheetsOpenKey]);

  // Persist sheetsOpen whenever it changes
  useEffect(() => {
    if (!sheetsOpenKey) return;
    try { localStorage.setItem(sheetsOpenKey, String(sheetsOpen)); } catch {}
  }, [sheetsOpen, sheetsOpenKey]);

  // Load persisted kanbanOpen when user changes
  useEffect(() => {
    if (!kanbanOpenKey) return;
    try {
      const v = localStorage.getItem(kanbanOpenKey);
      if (v === 'true' || v === 'false') setKanbanOpen(v === 'true');
    } catch {}
  }, [kanbanOpenKey]);

  // Persist kanbanOpen whenever it changes
  useEffect(() => {
    if (!kanbanOpenKey) return;
    try { localStorage.setItem(kanbanOpenKey, String(kanbanOpen)); } catch {}
  }, [kanbanOpen, kanbanOpenKey]);

  // Load persisted statsOpen when user changes
  useEffect(() => {
    if (!statsOpenKey) return;
    try {
      const v = localStorage.getItem(statsOpenKey);
      if (v === 'true' || v === 'false') setStatsOpen(v === 'true');
    } catch {}
  }, [statsOpenKey]);

  // Persist statsOpen whenever it changes
  useEffect(() => {
    if (!statsOpenKey) return;
    try { localStorage.setItem(statsOpenKey, String(statsOpen)); } catch {}
  }, [statsOpen, statsOpenKey]);

  useEffect(() => {
    fetchUserDocuments();
    // fetch CSV imports (user-scoped via JWT in backend)
    (async () => {
      try {
        const data = await csvService.listImports();
        setCsvImports(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Failed to load CSV imports', e);
        setCsvImports([]);
      }
    })();
  }, [user]); // Re-run effect when the user object changes

  const openRename = (doc) => setRenameState({ open: true, doc, saving: false });
  const closeRename = () => setRenameState({ open: false, doc: null, saving: false });
  const submitRename = async (newTitle) => {
    if (!renameState.doc) return;
    try {
      setRenameState((s) => ({ ...s, saving: true }));
      await documentService.renameDocument(renameState.doc.id, newTitle);
      // Optimistically update UI without refetch
      setUserDocuments((prev) => prev.map(d => d.id === renameState.doc.id ? { ...d, title: newTitle } : d));
      closeRename();
    } catch (err) {
      console.error('Rename failed:', err);
      setError(err.error || 'Rename failed. Please try again.');
      setRenameState((s) => ({ ...s, saving: false }));
    }
  };

  const openRenameSheet = (imp) => setRenameSheetState({ open: true, imp, saving: false });
  const closeRenameSheet = () => setRenameSheetState({ open: false, imp: null, saving: false });
  const submitRenameSheet = async (newName) => {
    if (!renameSheetState.imp) return;
    try {
      setRenameSheetState((s) => ({ ...s, saving: true }));
      await csvService.renameImport(renameSheetState.imp.id, newName);
      const oldName = (renameSheetState.imp.filename || 'csv').replace(/\.[^/.]+$/, '');
      const oldSlug = slugify(oldName);
      const newSlug = slugify(newName);
      setCsvImports((prev) => prev.map(i => i.id === renameSheetState.imp.id ? { ...i, filename: newName } : i));
      if (currentCsvSlug && currentCsvSlug === oldSlug) {
        navigate(`/csv/${newSlug}?importId=${renameSheetState.imp.id}`);
      }
      closeRenameSheet();
    } catch (err) {
      console.error('Rename sheet failed:', err);
      setError(err.error || 'Rename failed. Please try again.');
      setRenameSheetState((s) => ({ ...s, saving: false }));
    }
  };

  const slugify = (str) =>
    (str || '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  return (
    <ThemeProvider theme={darkTheme}>
      <LoaderOverlay open={loading} text="Uploading..." />
      <SuccessAlert
        open={successAlertOpen}
        message="Your file was successfully processed."
        onClose={() => setSuccessAlertOpen(false)}
        autoHideDuration={5000}
      />
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Drawer variant="permanent">
          <Box sx={{ p: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              fullWidth
              onClick={() => setOpenSampleModal(true)}
              sx={{
                color: 'common.white',
                justifyContent: 'flex-start',
                textTransform: 'none',
                backgroundColor: theme.palette.grey[800],
                '&:hover': {
                  backgroundColor: theme.palette.grey[500],
                },
              }}
            >
              Add Space
            </Button>

          </Box>
          {/* Tutorial Courses
          <Box
            onClick={() => setTutorialsOpen((v) => !v)}
            sx={{
              px: 2,
              py: 1,
              mt: 1,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: tutorialsOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Box className="section-label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MenuBookIcon fontSize="small" sx={{ color: 'common.white' }} />
              <Typography variant="caption" sx={{ color: 'common.white' }}>
                Tutorial Courses
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setTutorialsOpen((v) => !v); }}
              aria-label={tutorialsOpen ? 'collapse courses' : 'expand courses'}
              sx={{ color: 'common.white' }}
            >
              {tutorialsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={tutorialsOpen} timeout="auto" unmountOnExit>
            <Typography sx={{ px: 2, color: 'text.secondary', fontStyle: 'italic' }}>No courses yet.</Typography>
          </Collapse> */}
          <Box>

              <List dense>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate('/home')} selected={isHome} sx={{ '&.Mui-selected': { backgroundColor: 'rgba(255, 255, 255, 0.08)' }, '&.Mui-selected:hover': { backgroundColor: 'rgba(255, 255, 255, 0.12)' } }}>
                    <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                      <HomeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Home" />
                  </ListItemButton>
                </ListItem>
              </List>

          </Box>

          <Box
            onClick={() => setDocsOpen((v) => !v)}
            sx={{
              px: 2,
              py: 1,
              mt: 2,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: docsOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Box className="docs-label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FolderIcon fontSize="small" sx={{ color: 'common.white' }} />
              <Typography variant="caption" sx={{ color: 'common.white' }}>
                Study Documents
              </Typography>
            </Box>
            <IconButton
              className="docs-toggle"
              size="small"
              onClick={(e) => { e.stopPropagation(); setDocsOpen((v) => !v); }}
              aria-label={docsOpen ? 'collapse documents' : 'expand documents'}
              sx={{ color: 'common.white' }}
            >
              {docsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={docsOpen} timeout="auto" unmountOnExit>
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
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        className="rename-button"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRename(doc);
                        }}
                        sx={{
                          mr: 0.5,
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                        aria-label="rename document"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        className="delete-button"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc);
                        }}
                        sx={{
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: theme.palette.error.main,
                          '&:hover': {
                            color: theme.palette.error.light,
                          }
                        }}
                        aria-label="delete document"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                  sx={{
                    position: 'relative',
                    '&:hover .delete-button, &:hover .rename-button': {
                      opacity: 1,
                    }
                  }}
                >
                  <ListItemButton
                    onClick={() => {
                      const slug = slugify(doc.title || String(doc.id));
                      try { localStorage.setItem('lastDocSlug', slug); } catch {}
                      navigate(`/documents/${slug}`);
                      onDocumentSelect?.(doc.id);
                    }}
                    selected={
                      selectedDocumentId === doc.id ||
                      (currentDocSlug && slugify(doc.title || String(doc.id)) === currentDocSlug)
                    }
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      },
                      '&.Mui-selected:hover': {
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
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>

          {/* Study Sheets */}
          <Box
            onClick={() => setSheetsOpen((v) => !v)}
            sx={{
              px: 2,
              py: 1,
              mt: 1,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: sheetsOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Box className="section-label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon fontSize="small" sx={{ color: 'common.white' }} />
              <Typography variant="caption" sx={{ color: 'common.white' }}>
                Study Sheets
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setSheetsOpen((v) => !v); }}
              aria-label={sheetsOpen ? 'collapse sheets' : 'expand sheets'}
              sx={{ color: 'common.white' }}
            >
              {sheetsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={sheetsOpen} timeout="auto" unmountOnExit>
            {csvImports.length === 0 ? (
              <Typography sx={{ px: 2, color: 'text.secondary', fontStyle: 'italic' }}>No sheets yet.</Typography>
            ) : (
              <List dense>
                {csvImports.map((imp) => {
                  const name = (imp.filename || 'csv').replace(/\.[^/.]+$/, '');
                  const slug = slugify(name);
                  return (
                    <ListItem
                      key={imp.id}
                      disablePadding
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton
                            className="rename-button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameSheet(imp);
                            }}
                            sx={{
                              mr: 0.5,
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                            aria-label="rename sheet"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            className="delete-button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSheet(imp);
                            }}
                            sx={{
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              color: theme.palette.error.main,
                              '&:hover': {
                                color: theme.palette.error.light,
                              }
                            }}
                            aria-label="delete sheet"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                      sx={{
                        position: 'relative',
                        '&:hover .delete-button, &:hover .rename-button': {
                          opacity: 1,
                        }
                      }}
                    >
                      <ListItemButton
                        onClick={() => navigate(`/csv/${slug}?importId=${imp.id}`)}
                        selected={currentCsvSlug && slug === currentCsvSlug}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          },
                          '&.Mui-selected:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.12)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                          <DescriptionIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={name}
                          primaryTypographyProps={{
                            style: {
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Collapse>

          {/* Kanban Tasks */}
          <Box
            onClick={() => setKanbanOpen((v) => !v)}
            sx={{
              px: 2,
              py: 1,
              mt: 1,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: kanbanOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Box className="section-label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ViewKanbanIcon fontSize="small" sx={{ color: 'common.white' }} />
              <Typography variant="caption" sx={{ color: 'common.white' }}>
                Kanban Tasks
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setKanbanOpen((v) => !v); }}
              aria-label={kanbanOpen ? 'collapse kanban' : 'expand kanban'}
              sx={{ color: 'common.white' }}
            >
              {kanbanOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={kanbanOpen} timeout="auto" unmountOnExit>
            <Typography sx={{ px: 2, color: 'text.secondary', fontStyle: 'italic' }}>No tasks yet.</Typography>
          </Collapse>

          {/* Stats */}
          <Box
            onClick={() => setStatsOpen((v) => !v)}
            sx={{
              px: 2,
              py: 1,
              mt: 1,
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: 1,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: statsOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Box className="section-label" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChartIcon fontSize="small" sx={{ color: 'common.white' }} />
              <Typography variant="caption" sx={{ color: 'common.white' }}>
                Stats
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setStatsOpen((v) => !v); }}
              aria-label={statsOpen ? 'collapse stats' : 'expand stats'}
              sx={{ color: 'common.white' }}
            >
              {statsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={statsOpen} timeout="auto" unmountOnExit>
            <Typography sx={{ px: 2, color: 'text.secondary', fontStyle: 'italic' }}>No stats yet.</Typography>
          </Collapse>
          <Box sx={{ flexGrow: 1 }} /> 
          
          {/* Logout button at the bottom */}
          <Divider />
          <List dense>
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigate('/pricing')}>
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                    <WorkspacePremiumIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Upgrade Plan" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => onOpenSettings?.()}>
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5 }}>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </ListItemButton>
            </ListItem>
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
        <AddSpaceModal
          open={openSampleModal}
          onClose={() => setOpenSampleModal(false)}
          onImportDocument={async (file) => { await uploadFile(file); setOpenSampleModal(false); }}
          onImportSheet={async (file) => {
            try {
              const res = await csvService.uploadCSV(file);
              setOpenSampleModal(false);
              // Navigate to csv page for this import using filename as slug
              const name = (file?.name || 'csv').replace(/\.[^/.]+$/, '');
              const slug = slugify(name);
              navigate(`/csv/${slug}?importId=${res?.import?.id || ''}`);
            } catch (e) {
              console.error('CSV import failed', e);
              alert('CSV import failed');
            }
          }}
          onCreateTutorial={() => { console.log('Create tutorial'); setOpenSampleModal(false); }}
          onCreateKanban={() => { console.log('Create kanban'); setOpenSampleModal(false); }}
        />
      </Box>
      <RenameDialog
        open={renameState.open}
        initialValue={renameState.doc?.title || ''}
        onClose={closeRename}
        onSubmit={submitRename}
        submitting={renameState.saving}
      />
      <RenameDialog
        open={renameSheetState.open}
        initialValue={(renameSheetState.imp?.filename || '').replace(/\.[^/.]+$/, '')}
        onClose={closeRenameSheet}
        onSubmit={submitRenameSheet}
        submitting={renameSheetState.saving}
        title="Rename Sheet"
        label="Sheet name"
      />
    </ThemeProvider>
  );
}
