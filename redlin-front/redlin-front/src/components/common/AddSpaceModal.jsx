import React, { useRef, useState, useMemo } from 'react';
import {
  Dialog,
  IconButton,
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import { csvService } from '../../services/api/csv';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';

// Props:
// - open: boolean
// - onClose: () => void
// - onImportDocument?: (file: File) => void
// - onImportSheet?: (file: File) => void
// - onCreateTutorial?: () => void
// - onCreateKanban?: () => void
const AddSpaceModal = ({
  open,
  onClose,
  onImportDocument,
  onImportSheet,
  // onCreateTutorial,
  onCreateKanban,
}) => {
  const [selected, setSelected] = useState('document'); // 'document' | 'sheet' | 'tutorial' | 'kanban'
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const options = useMemo(
    () => [
      { key: 'document', label: 'Import Document', icon: <InsertDriveFileIcon fontSize="small" /> },
      { key: 'sheet', label: 'Import Sheet', icon: <DescriptionIcon fontSize="small" /> },
      // { key: 'tutorial', label: 'Create Tutorial', icon: <MenuBookIcon fontSize="small" /> },
      { key: 'kanban', label: 'Create Kanban Task', icon: <ViewKanbanIcon fontSize="small" /> },
    ],
    []
  );

  const handleOpenFile = () => fileInputRef.current?.click();

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (selected === 'document') {
      onImportDocument?.(file);
    } else if (selected === 'sheet') {
      // CSV import path
      try {
        await onImportSheet?.(file);
      } catch {}
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (dt && dt.files) handleFiles(dt.files);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: '96vw', sm: '94vw', md: 1080, lg: 1200 },
          maxWidth: '96vw',
          minHeight: { xs: 600, md: 700, lg: 800 },
          borderRadius: 4,
          boxShadow: 20,
          overflow: 'hidden',
          backgroundColor: '#000000', // forced for visual verification
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(0,0,0,0.6)' } },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          disableRipple
          disableFocusRipple
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 2,
            p: 0.5,
            color: 'text.secondary',
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: 'transparent', color: 'text.secondary' },
            '&:active': { backgroundColor: 'transparent' },
            '&:focus': { outline: 'none' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            display: 'flex',
            minHeight: { xs: 520, md: 560 },
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 3 },
            alignItems: 'stretch',
            gap: { xs: 1, md: 2 },
          }}
        >
          {/* Left menu */}
          <Box sx={{ width: { xs: 250, md: 280 }, p: { xs: 2, md: 3 } }}>
            <List dense disablePadding>
              {options.map((opt) => (
                <ListItem key={opt.key} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    selected={selected === opt.key}
                    onClick={() => setSelected(opt.key)}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'rgba(255,255,255,0.12)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>{opt.icon}</ListItemIcon>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={opt.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Centered vertical divider with spacing (not full height) */}
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', mx: { xs: 1, md: 2 } }}>
            <Box
              sx={{
                width: 1,
                height: { xs: '76%', md: '82%' },
                bgcolor: 'divider',
                opacity: 0.25,
                borderRadius: 1,
              }}
            />
          </Box>

          {/* Right content */}
          <Box
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 3, md: 6 },
            }}
          >
            {selected === 'document' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Box sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 96,
                  height: 96,
                  borderRadius: 3,
                  border: '2px solid',
                  borderColor: 'divider',
                  mb: 2,
                }}>
                  <FolderOpenOutlinedIcon sx={{ fontSize: 52 }} />
                </Box>
                <Typography variant="h5" sx={{ mb: 1.5, letterSpacing: 0.2 }}>Choose a File to Import</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                  Drag and drop your PDF to create the Document space.
                  <br />
                  or
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleOpenFile}
                  sx={{
                    color: 'white',
                    borderRadius: 2,
                    px: 3,
                    backgroundColor: (t) => t.palette.grey[700],
                    '&:hover': { backgroundColor: (t) => t.palette.grey[600] },
                  }}
                >
                  Import from files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {isDragging && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    Drop the file to import
                  </Typography>
                )}
              </Box>
            )}

            {selected === 'sheet' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Import a Sheet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Drag and drop your sheet file or choose from your files.
                </Typography>
                <Button variant="contained" onClick={handleOpenFile}>Choose file</Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </Box>
            )}

            {/* {selected === 'tutorial' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Create Tutorial</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Start a new tutorial space.
                </Typography>
                <Button variant="contained" onClick={onCreateTutorial}>Create</Button>
              </Box>
            )} */}

            {selected === 'kanban' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Create Kanban Task</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Start a new kanban task space.
                </Typography>
                <Button variant="contained" onClick={onCreateKanban}>Create</Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default AddSpaceModal;
