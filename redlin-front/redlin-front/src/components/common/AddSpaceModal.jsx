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
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import MicIcon from '@mui/icons-material/Mic';
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
// - onCreateVideo?: ({ url: string, languages?: string[] }) => void
// - onCreateClassroom?: ({ title: string, language?: string }) => void
const AddSpaceModal = ({
  open,
  onClose,
  onImportDocument,
  onImportSheet,
  // onCreateTutorial,
  onCreateKanban,
  onCreateVideo,
  onCreateClassroom,
  creatingVideo = false,
}) => {
  const [selected, setSelected] = useState('document'); // 'document' | 'sheet' | 'video' | 'kanban' | 'classroom'
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLangs, setVideoLangs] = useState(''); // comma separated languages
  const [classroomTitle, setClassroomTitle] = useState('Classroom Session');
  const [classroomLanguage, setClassroomLanguage] = useState('es');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const options = useMemo(
    () => [
      { key: 'document', label: 'Import Document', icon: <InsertDriveFileIcon fontSize="small" /> },
  { key: 'sheet', label: 'Import Sheet', icon: <DescriptionIcon fontSize="small" /> },
  { key: 'video', label: 'Add YouTube Video', icon: <OndemandVideoIcon fontSize="small" /> },
      { key: 'classroom', label: 'Create Classroom Space', icon: <MicIcon fontSize="small" /> },
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
        style: {
          backgroundColor: '#1A2A3A',
        },
        sx: {
          width: { xs: '92vw', sm: 520, md: 580 },
          maxWidth: '92vw',
          minHeight: { xs: 400, md: 440 },
          borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'transparent',
            pointerEvents: 'none',
          },
        },
      }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'color-mix(in srgb, var(--color-black) 60%, transparent)' } },
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
            color: 'var(--color-text-muted-on-dark)',
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-white)' },
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
          <Box sx={{ width: { xs: 180, md: 200 }, p: { xs: 1.5, md: 2 } }}>
            <List dense disablePadding>
              {options.map((opt) => (
                <ListItem key={opt.key} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={selected === opt.key}
                    onClick={() => setSelected(opt.key)}
                    sx={{
                      borderRadius: '10px',
                      py: 1,
                      color: 'var(--color-text-muted-on-dark)',
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(32, 201, 151, 0.15)',
                        color: 'var(--color-white)',
                      },
                      '&.Mui-selected:hover': {
                        backgroundColor: 'rgba(32, 201, 151, 0.22)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>{opt.icon}</ListItemIcon>
                    <ListItemText primaryTypographyProps={{ variant: 'body2', sx: { color: 'inherit' } }} primary={opt.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Centered vertical divider with spacing (not full height) */}
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', mx: { xs: 0.5, md: 1 } }}>
            <Box
              sx={{
                width: 1,
                height: { xs: '70%', md: '75%' },
                bgcolor: 'rgba(255,255,255,0.08)',
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
              p: { xs: 2, md: 3 },
            }}
          >
            {selected === 'document' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Box sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 72,
                  height: 72,
                  borderRadius: '16px',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  mb: 2,
                }}>
                  <FolderOpenOutlinedIcon sx={{ fontSize: 36, color: 'var(--color-text-muted-on-dark)' }} />
                </Box>
                <Typography variant="h5" sx={{ mb: 1.5, letterSpacing: 0.2, color: 'var(--color-white)' }}>Choose a File to Import</Typography>
                <Typography variant="body2" sx={{ mb: 2.5, color: 'var(--color-text-muted-on-dark)' }}>
                  Drag and drop your PDF to create the Document space.
                  <br />
                  or
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleOpenFile}
                  sx={{
                    color: 'var(--color-navy)',
                    borderRadius: '12px',
                    px: 3,
                    py: 1.2,
                    background: 'var(--color-teal)',
                    fontWeight: 600,
                    '&:hover': { background: 'var(--color-teal-deep)', boxShadow: '0 6px 20px rgba(32, 201, 151, 0.3)' },
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
                  <Typography variant="caption" color="var(--color-text-muted-on-dark)" sx={{ display: 'block', mt: 2 }}>
                    Drop the file to import
                  </Typography>
                )}
              </Box>
            )}

            {selected === 'sheet' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Typography variant="h6" sx={{ mb: 1.5, color: 'var(--color-white)' }}>Import a Sheet</Typography>
                <Typography variant="body2" color="var(--color-text-muted-on-dark)" sx={{ mb: 2 }}>
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
                <Typography variant="h6" sx={{ mb: 1.5, color: 'var(--color-white)' }}>Create Tutorial</Typography>
                <Typography variant="body2" color="var(--color-text-muted-on-dark)" sx={{ mb: 2 }}>
                  Start a new tutorial space.
                </Typography>
                <Button variant="contained" onClick={onCreateTutorial}>Create</Button>
              </Box>
            )} */}

            {selected === 'video' && (
              <Box sx={{ maxWidth: 520, width: '100%' }}>
                <Typography variant="h6" sx={{ mb: 1.5, color: 'var(--color-white)' }}>Add a YouTube Video</Typography>
                <Typography variant="body2" color="var(--color-text-muted-on-dark)" sx={{ mb: 2 }}>
                  Paste a YouTube URL. We will fetch transcript, summary and MCQs.
                </Typography>
                <Box component="form" onSubmit={(e)=>{e.preventDefault(); onCreateVideo?.({ url: videoUrl.trim(), languages: videoLangs.split(',').map(l=>l.trim()).filter(Boolean) });}}>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e)=>setVideoUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid color-mix(in srgb, var(--color-white) 20%, transparent)',
                      background: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
                      color: 'white',
                      marginBottom: 12,
                      fontSize: 14
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Preferred languages (comma separated, e.g. en,es)"
                    value={videoLangs}
                    onChange={(e)=>setVideoLangs(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid color-mix(in srgb, var(--color-white) 20%, transparent)',
                      background: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
                      color: 'white',
                      marginBottom: 16,
                      fontSize: 13
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={!videoUrl || creatingVideo}
                    onClick={()=> onCreateVideo?.({ url: videoUrl.trim(), languages: videoLangs.split(',').map(l=>l.trim()).filter(Boolean) })}
                  >
                    {creatingVideo ? 'Creating...' : 'Add Video'}
                  </Button>
                </Box>
              </Box>
            )}

            {selected === 'classroom' && (
              <Box sx={{ maxWidth: 520, width: '100%' }}>
                <Typography variant="h6" sx={{ mb: 1.5, color: 'var(--color-white)' }}>Create a Classroom Space</Typography>
                <Typography variant="body2" color="var(--color-text-muted-on-dark)" sx={{ mb: 2 }}>
                  Start a dedicated space for a live class recording. After you stop, you can process the transcription.
                </Typography>
                <Box component="form" onSubmit={(e) => { e.preventDefault(); onCreateClassroom?.({ title: classroomTitle.trim(), language: classroomLanguage.trim() || 'es' }); }}>
                  <input
                    type="text"
                    placeholder="Classroom title"
                    value={classroomTitle}
                    onChange={(e) => setClassroomTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid color-mix(in srgb, var(--color-white) 20%, transparent)',
                      background: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
                      color: 'white',
                      marginBottom: 12,
                      fontSize: 14
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Language code (es, en, etc.)"
                    value={classroomLanguage}
                    onChange={(e) => setClassroomLanguage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid color-mix(in srgb, var(--color-white) 20%, transparent)',
                      background: 'color-mix(in srgb, var(--color-white) 4%, transparent)',
                      color: 'white',
                      marginBottom: 16,
                      fontSize: 13
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={() => onCreateClassroom?.({ title: classroomTitle.trim(), language: classroomLanguage.trim() || 'es' })}
                    disabled={!classroomTitle.trim()}
                  >
                    Create Classroom
                  </Button>
                </Box>
              </Box>
            )}

            {selected === 'kanban' && (
              <Box sx={{ textAlign: 'center', maxWidth: 520 }}>
                <Typography variant="h6" sx={{ mb: 1.5, color: 'var(--color-white)' }}>Create Kanban Task</Typography>
                <Typography variant="body2" color="var(--color-text-muted-on-dark)" sx={{ mb: 2 }}>
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
