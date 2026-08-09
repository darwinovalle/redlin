import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import BarChartIcon from '@mui/icons-material/BarChart';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import MicIcon from '@mui/icons-material/Mic';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { documentService } from '../../../services/api';
import { videoService } from '../../../services/api/video';
import { classroomService } from '../../../services/api/classroom';
import { csvService } from '../../../services/api/csv';
import LoaderOverlay from '../../../components/common/LoaderOverlay';
import SuccessAlert from '../../../components/common/SuccessAlert';
import RenameDialog from '../../../components/common/RenameDialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { useNavigate, useLocation } from 'react-router-dom';

const SIDEBAR_WIDTH = 288;
const SidebarSpacer = styled('div')(() => ({
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  minHeight: '100vh'
}));
const SidebarShell = styled('div')(() => ({
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  top: 0,
  left: 0,
  backgroundColor: 'var(--color-navy)', // solid dark per mock
  color: 'var(--color-white)',
  fontFamily: "'Poppins', 'Titillium Web', Arial, sans-serif",
  borderRight: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)',
  zIndex: 10
}));
const NavItem = styled('button')(() => ({
  display: 'flex', alignItems: 'center', width: '100%', padding: '14px 24px', color: 'color-mix(in srgb, var(--color-white) 80%, transparent)', fontSize: 16, cursor: 'pointer', position: 'relative', transition: 'background .25s,color .25s', userSelect: 'none', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', lineHeight: 'inherit', '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'var(--color-white)' }, '&.active': { backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', color: 'var(--color-white)' }, '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '-2px' }
}));
const SectionTitle = styled('div')(() => ({ padding: '0 24px', margin: '16px 0 8px', fontSize: 12, textTransform: 'uppercase', color: 'color-mix(in srgb, var(--color-white) 50%, transparent)', letterSpacing: 1 }));
const ItemIcon = styled('span')(() => ({ display: 'inline-flex', marginRight: 16, fontSize: 20, alignItems: 'center', justifyContent: 'center' }));
// Small status dot shown at the left of each sidebar item, next to its icon.
// Green = completed; any other/unknown status shows as red.
const StatusDot = ({ complete }) => (
  <span
    aria-hidden="true"
    style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
      marginRight: 10,
      display: 'inline-block',
      boxShadow: complete
        ? '0 0 0 3px color-mix(in srgb, var(--color-success) 14%, transparent)'
        : '0 0 0 3px color-mix(in srgb, var(--color-danger-soft) 12%, transparent)',
      backgroundColor: complete ? 'var(--color-success)' : 'var(--color-danger-soft)',
    }}
  />
);
const NestedList = styled('div')(() => ({ paddingLeft: 8 }));
const UserProfile = styled('div')(() => ({ padding: '16px 24px', borderTop: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', display: 'flex', alignItems: 'center' }));
const Avatar = styled('div')(() => ({ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontWeight: 500, fontSize: 14 }));

// Reusable 3-dot kebab menu for sidebar items (Rename / Delete).
const ItemMenu = ({ onRename, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleOpen = (e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); };
  const handleClose = (e) => { e?.stopPropagation?.(); setAnchorEl(null); };
  return (
    <>
      <IconButton
        size="small"
        aria-label="Item options"
        onClick={handleOpen}
        sx={{
          color: 'color-mix(in srgb, var(--color-white) 70%, transparent)',
          '&:hover': { color: 'var(--color-white)', backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)' },
          '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '-2px' },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: 2,
              minWidth: 150,
              backgroundColor: 'var(--color-navy-700)',
              color: 'var(--color-white)',
              border: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)',
              boxShadow: '0 18px 48px color-mix(in srgb, var(--color-black) 40%, transparent)',
            },
          },
        }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); handleClose(); onRename?.(); }} sx={{ fontSize: 14, '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' } }}>
          Rename
        </MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); handleClose(); onDelete?.(); }} sx={{ fontSize: 14, color: 'var(--color-danger-soft)', '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-danger-softer) 14%, transparent)' } }}>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
};

export default function MiniDrawer({ selectedDocumentId, onDocumentSelect, onDocumentDelete, onLogout, onOpenSettings }) {
  const [loading, setLoading] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname.startsWith('/home');
  const isBooks = location.pathname.startsWith('/books');
  const isDocuments = location.pathname.startsWith('/documents');
  const isVideos = location.pathname.startsWith('/videos');
  const isClassroom = location.pathname.startsWith('/classroom');
  const isSubjects = location.pathname.startsWith('/subjects');
  const isStats = location.pathname.startsWith('/stats');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  // close the mobile drawer whenever a nav item navigates
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  const currentDocSlug = React.useMemo(() => { const m = location.pathname.match(/^\/documents\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const currentCsvSlug = React.useMemo(() => { const m = location.pathname.match(/^\/csv\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const currentClassroomSessionId = React.useMemo(() => { const m = location.pathname.match(/^\/classroom\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const currentVideoId = React.useMemo(() => { const m = location.pathname.match(/^\/videos\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const sidebarStateKey = React.useMemo(() => user?.id ? `sidebar:${user.id}:sections` : null, [user?.id]);
  const [userDocuments,setUserDocuments]=useState([]);
  const [loadingDocs,setLoadingDocs]=useState(false);
  const [fetchError,setFetchError]=useState(null);
  const [csvImports,setCsvImports]=useState([]);
  const [videos,setVideos]=useState([]);
  const [loadingVideos,setLoadingVideos]=useState(false);
  const [videoError,setVideoError]=useState(null);
  const [classroomSessions,setClassroomSessions]=useState([]);
  const [loadingClassroomSessions,setLoadingClassroomSessions]=useState(false);
  const [classroomError,setClassroomError]=useState(null);
  const [docsOpen,setDocsOpen]=useState(!isHome);
  const [classroomOpen,setClassroomOpen]=useState(false);
  const [sheetsOpen,setSheetsOpen]=useState(false);
  const [kanbanOpen,setKanbanOpen]=useState(false);
  const [videosOpen,setVideosOpen]=useState(false);
  const [statsOpen,setStatsOpen]=useState(false);
  const sidebarStateHydratedRef = React.useRef(false);
  const [renameState,setRenameState]=useState({open:false,doc:null,saving:false});
  const [renameSheetState,setRenameSheetState]=useState({open:false,imp:null,saving:false});
  const [renameVideoState,setRenameVideoState]=useState({open:false,video:null,saving:false});
  const [renameClassState,setRenameClassState]=useState({open:false,session:null,saving:false});
  const [confirmState,setConfirmState]=useState({open:false,title:'',message:'',onConfirm:null,confirming:false});
  const [error,setError]=useState(null);
  const slugify = (str)=> (str||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
  const fetchUserDocuments=async()=>{ if(!user?.id){setUserDocuments([]);return;} setLoadingDocs(true); setFetchError(null); try{ const docs=await documentService.getUserDocuments(user.id); setUserDocuments(docs);}catch(e){ setFetchError(e?.message||'Could not load documents'); } finally { setLoadingDocs(false);} };
  const fetchClassroomSessions = async () => {
      if (!user?.id) {                                                                                                                                        
        setClassroomSessions([]);           
        return;                                                                                                                                               
      }                                        
      setLoadingClassroomSessions(true);                                                                                                                      
      setClassroomError(null);                                                                                                                                
      try {                                                                                                                                                   
        const response = await classroomService.listSessions();                                                                                               
                                                                                                                                                              
        // LOGGING: This will help us see exactly what the server is sending in the Console (F12)                                                             
        console.log("Classroom API Response:", response);                                                                                                     
                                                                                                                                                              
        // FIX: Handle both plain arrays [ ] and paginated objects { results: [ ] }                                                                           
        let sessions = [];                     
        if (Array.isArray(response)) {                                                                                                                        
          sessions = response;                                                                                                                                
        } else if (response && typeof response === 'object' && response.results) {                                                                            
          sessions = response.results;                                                                                                                        
        } else if (response && typeof response === 'object') {                                                                                                
          // Fallback for any other object structure that might contain the list                                                                              
          const possibleArray = Object.values(response).find(val => Array.isArray(val));                                                                      
          sessions = possibleArray || [];                                                                                                                     
        }                                                                                                                                                     
                                                                                                                                                              
        setClassroomSessions(sessions);                                                                                                                       
      } catch (e) {                                                                                                                                           
        console.error("Sidebar fetch error:", e);                                                                                                             
        setClassroomError(e?.message || 'Could not load lectures');                                                                                   
      } finally {                                                                                                                                             
        setLoadingClassroomSessions(false);                                                                                                                   
      }                                                                                                                                                       
    }; 
  const openConfirm=({title,message,onConfirm})=> setConfirmState({open:true,title,message,onConfirm,confirming:false});
  const closeConfirm=()=> setConfirmState({open:false,title:'',message:'',onConfirm:null,confirming:false});
  const runConfirm=async()=>{ if(!confirmState.onConfirm) return; try{ setConfirmState(s=>({...s,confirming:true})); await confirmState.onConfirm(); closeConfirm(); }catch{ closeConfirm(); alert('Failed to delete'); } };
  const handleDeleteDocument=(doc)=> openConfirm({ title:'Delete document?', message:`Are you sure you want to delete "${doc.title}"? This cannot be undone.`, onConfirm:async()=>{ await documentService.deleteDocument(doc.id); setUserDocuments(d=>d.filter(x=>x.id!==doc.id)); if(currentDocSlug && slugify(doc.title||String(doc.id))===currentDocSlug) navigate('/home'); } });
  const handleDeleteSheet=(imp)=> openConfirm({ title:'Delete sheet?', message:`Are you sure you want to delete "${imp.filename}"? This cannot be undone.`, onConfirm:async()=>{ await csvService.deleteImport(imp.id); setCsvImports(s=>s.filter(x=>x.id!==imp.id)); } });
  const openRenameVideo=(v)=> setRenameVideoState({open:true,video:v,saving:false});
  const closeRenameVideo=()=> setRenameVideoState({open:false,video:null,saving:false});
  const submitRenameVideo=async(newTitle)=>{ if(!renameVideoState.video) return; try{ setRenameVideoState(s=>({...s,saving:true})); await videoService.renameVideo(renameVideoState.video.id,newTitle); setVideos(d=>d.map(x=>x.id===renameVideoState.video.id?{...x,title:newTitle}:x)); closeRenameVideo(); }catch(e){ setError(e?.error||'Rename failed'); setRenameVideoState(s=>({...s,saving:false})); } };
  const handleDeleteVideo=(v)=> openConfirm({ title:'Delete video?', message:`Are you sure you want to delete "${v.title||v.video_id||'this video'}"? This cannot be undone.`, onConfirm:async()=>{ await videoService.deleteVideo(v.id); setVideos(d=>d.filter(x=>x.id!==v.id)); } });
  const openRenameClass=(s)=> setRenameClassState({open:true,session:s,saving:false});
  const closeRenameClass=()=> setRenameClassState({open:false,session:null,saving:false});
  const submitRenameClass=async(newTitle)=>{ if(!renameClassState.session) return; try{ setRenameClassState(s=>({...s,saving:true})); await classroomService.renameSession(renameClassState.session.id,newTitle); setClassroomSessions(d=>d.map(x=>x.id===renameClassState.session.id?{...x,title:newTitle}:x)); closeRenameClass(); }catch(e){ setError(e?.error||'Rename failed'); setRenameClassState(s=>({...s,saving:false})); } };
  const handleDeleteClass=(s)=> openConfirm({ title:'Delete lecture?', message:`Are you sure you want to delete "${s.title}"? This cannot be undone.`, onConfirm:async()=>{ await classroomService.deleteSession(s.id); setClassroomSessions(d=>d.filter(x=>x.id!==s.id)); if(currentClassroomSessionId && String(s.id)===currentClassroomSessionId) navigate('/home'); } });
  useEffect(() => {
    sidebarStateHydratedRef.current = false;

    const resetDefaults = () => {
      setDocsOpen(!isHome);
      setClassroomOpen(false);
      setSheetsOpen(false);
      setKanbanOpen(false);
      setVideosOpen(false);
      setStatsOpen(false);
    };

    if (!sidebarStateKey) {
      resetDefaults();
      sidebarStateHydratedRef.current = true;
      return;
    }

    try {
      const raw = localStorage.getItem(sidebarStateKey);
      if (!raw) {
        resetDefaults();
      } else {
        const parsed = JSON.parse(raw);
        setDocsOpen(typeof parsed?.docsOpen === 'boolean' ? parsed.docsOpen : !isHome);
        setClassroomOpen(typeof parsed?.classroomOpen === 'boolean' ? parsed.classroomOpen : false);
        setSheetsOpen(typeof parsed?.sheetsOpen === 'boolean' ? parsed.sheetsOpen : false);
        setKanbanOpen(typeof parsed?.kanbanOpen === 'boolean' ? parsed.kanbanOpen : false);
        setVideosOpen(typeof parsed?.videosOpen === 'boolean' ? parsed.videosOpen : false);
        setStatsOpen(typeof parsed?.statsOpen === 'boolean' ? parsed.statsOpen : false);
      }
    } catch {
      resetDefaults();
    } finally {
      sidebarStateHydratedRef.current = true;
    }
  }, [sidebarStateKey, isHome]);

  useEffect(() => {
    if (!sidebarStateKey || !sidebarStateHydratedRef.current) return;
    try {
      localStorage.setItem(sidebarStateKey, JSON.stringify({
        docsOpen,
        classroomOpen,
        sheetsOpen,
        kanbanOpen,
        videosOpen,
        statsOpen
      }));
    } catch {}
  }, [sidebarStateKey, docsOpen, classroomOpen, sheetsOpen, kanbanOpen, videosOpen, statsOpen]);
  useEffect(()=>{ fetchUserDocuments(); fetchClassroomSessions(); (async()=>{ try{ const data=await csvService.listImports(); setCsvImports(Array.isArray(data)?data:[]);}catch{ setCsvImports([]);} })(); (async()=>{ if(!user){ setVideos([]); return;} setLoadingVideos(true); setVideoError(null); try{ const list=await videoService.listVideos(); setVideos(Array.isArray(list)?list:[]);}catch{ setVideoError('Could not load videos'); } finally { setLoadingVideos(false);} })(); },[user]);
  const openRename=(doc)=> setRenameState({open:true,doc,saving:false});
  const closeRename=()=> setRenameState({open:false,doc:null,saving:false});
  const submitRename=async(newTitle)=>{ if(!renameState.doc) return; try{ setRenameState(s=>({...s,saving:true})); await documentService.renameDocument(renameState.doc.id,newTitle); setUserDocuments(d=>d.map(x=>x.id===renameState.doc.id?{...x,title:newTitle}:x)); closeRename(); }catch(e){ setError(e?.error||'Rename failed'); setRenameState(s=>({...s,saving:false})); } };
  const openRenameSheet=(imp)=> setRenameSheetState({open:true,imp,saving:false});
  const closeRenameSheet=()=> setRenameSheetState({open:false,imp:null,saving:false});
  const submitRenameSheet=async(newName)=>{ if(!renameSheetState.imp) return; try{ setRenameSheetState(s=>({...s,saving:true})); await csvService.renameImport(renameSheetState.imp.id,newName); setCsvImports(d=>d.map(i=>i.id===renameSheetState.imp.id?{...i,filename:newName}:i)); closeRenameSheet(); }catch(e){ setError(e?.error||'Rename failed'); setRenameSheetState(s=>({...s,saving:false})); } };
  const sidebarContent = (
    <>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', marginBottom: 24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:64, transform:'translateY(8px)' }}>
            <div style={{ width:40, height:40, background:'linear-gradient(135deg,var(--color-teal),var(--color-blue))', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginRight:12, boxShadow:'0 0 20px color-mix(in srgb, var(--color-teal) 30%, transparent)' }}>
              <i className="ri-brain-line" style={{ fontSize:22, color:'var(--color-white)' }} />
            </div>
            <span style={{ display:'flex', alignItems:'center', lineHeight:1, fontSize:24, fontWeight:700, background:'linear-gradient(90deg,var(--color-white),var(--color-text-muted-on-dark))', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>Redlin</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          <div className="nav-section" style={{ marginBottom:24 }}>
            <NavItem type="button" className={isHome?'active':''} onClick={()=>navigate('/home')}>
              <ItemIcon><HomeIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span>Home</span>
            </NavItem>
            <SectionTitle>STUDY</SectionTitle>
            <NavItem type="button" onClick={()=>navigate('/classroom')} className={isClassroom?'active':''}>
              <ItemIcon><SchoolIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Lectures</span>
            </NavItem>
            <NavItem type="button" onClick={()=>navigate('/documents')} className={isDocuments?'active':''}>
              <ItemIcon><FolderIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Documents</span>
            </NavItem>
            <NavItem type="button" onClick={()=>navigate('/videos')} className={isVideos?'active':''}>
              <ItemIcon><OndemandVideoIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Videos</span>
            </NavItem>
            <NavItem type="button" onClick={()=>navigate('/books')} className={isBooks?'active':''}>
              <ItemIcon><MenuBookIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Books</span>
            </NavItem>
          </div>
          <SectionTitle>TRACK</SectionTitle>
          {/* <div className="nav-section">
            <NavItem type="button" onClick={()=>setSheetsOpen(v=>!v)} className={sheetsOpen?'active':''}>
              <ItemIcon><DescriptionIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Study Sheets</span>
              {sheetsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={sheetsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {csvImports.length===0 ? <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No sheets yet.</Typography> : csvImports.map(imp=>{ const name=(imp.filename||'csv').replace(/\.[^/.]+$/, ''); const slug=slugify(name); const active=currentCsvSlug && slug===currentCsvSlug; return (
                  <NavItem type="button" key={imp.id} className={active?'active':''} style={{ paddingLeft:40 }}
                    onClick={()=>navigate(`/csv/${slug}?importId=${imp.id}`)}
                    onMouseEnter={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='1';}}
                    onMouseLeave={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='0';}}
                  >
                    <ItemIcon><DescriptionIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</span>
                    <HoverActions className="hover-actions">
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); openRenameSheet(imp);}} sx={{ color:'color-mix(in srgb, var(--color-white) 70%, transparent)' }}><EditIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); handleDeleteSheet(imp);}} sx={{ color:'var(--color-danger-soft)' }}><DeleteIcon fontSize="inherit" /></IconButton>
                    </HoverActions>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
          </div> */}
          <div className="nav-section">
            <NavItem type="button" onClick={()=>navigate('/subjects')} className={isSubjects?'active':''}>
              <ItemIcon><ViewKanbanIcon sx={{ fontSize:20 }}/></ItemIcon>
              <span style={{ flex:1 }}>Subjects</span>
            </NavItem>
          </div>
          <div className="nav-section">
            <NavItem type="button" onClick={()=>navigate('/stats')} className={isStats?'active':''}>
              <ItemIcon><BarChartIcon sx={{ fontSize:20 }}/></ItemIcon>
              <span style={{ flex:1 }}>Stats</span>
            </NavItem>
          </div>
        </div>
        <SectionTitle>Settings</SectionTitle>
        {/* TODO: Re-enable when SaaS/Stripe launches — see MVP scope.
        <NavItem type="button" onClick={()=>navigate('/pricing')}><ItemIcon><WorkspacePremiumIcon sx={{ fontSize:20 }}/></ItemIcon><span>Upgrade Plan</span></NavItem> */}

        <NavItem type="button" onClick={()=>onOpenSettings?.()}><ItemIcon><SettingsIcon sx={{ fontSize:20 }}/></ItemIcon><span>API Settings</span></NavItem>
        <NavItem type="button" onClick={onLogout}><ItemIcon><LogoutIcon sx={{ fontSize:20 }}/></ItemIcon><span>Logout</span></NavItem>
        <UserProfile>
          <Avatar>{(user?.username || user?.email || 'U?').slice(0,2).toUpperCase()}</Avatar>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:500, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.username || user?.email || 'User'}</div>
            <div style={{ fontSize:12, color:'color-mix(in srgb, var(--color-white) 60%, transparent)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.email || ''}</div>
          </div>
        </UserProfile>

    </>
  );

  return (
    <>
      <LoaderOverlay open={loading} text="Uploading..." />
      <SuccessAlert open={successAlertOpen} message="Your file was successfully processed." onClose={()=>setSuccessAlertOpen(false)} autoHideDuration={5000} />

      {isMobile ? (
        <>
          {/* Slim fixed top bar with the nav hamburger (mobile only) */}
          <Box sx={{ display: 'flex', position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 1200, alignItems: 'center', px: 2, gap: 1, backgroundColor: 'var(--color-shell)', borderBottom: '1px solid var(--color-divider)' }}>
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" edge="start" sx={{ color: 'var(--color-teal-deep)' }}>
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>Redlin</Typography>
          </Box>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: SIDEBAR_WIDTH, boxSizing: 'border-box', backgroundColor: 'var(--color-navy)', color: 'var(--color-white)', fontFamily: "'Poppins', 'Titillium Web', Arial, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid color-mix(in srgb, var(--color-white) 8%, transparent)' } }}
          >
            {sidebarContent}
          </Drawer>
        </>
      ) : (
        <>
          <SidebarSpacer aria-hidden="true" />
          <SidebarShell>
            {sidebarContent}
          </SidebarShell>
        </>
      )}

      <RenameDialog open={renameState.open} initialValue={renameState.doc?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} />
      <RenameDialog open={renameSheetState.open} initialValue={(renameSheetState.imp?.filename || '').replace(/\.[^/.]+$/, '')} onClose={closeRenameSheet} onSubmit={submitRenameSheet} submitting={renameSheetState.saving} title="Rename Sheet" label="Sheet name" />
      <RenameDialog open={renameVideoState.open} initialValue={renameVideoState.video?.title || ''} onClose={closeRenameVideo} onSubmit={submitRenameVideo} submitting={renameVideoState.saving} title="Rename video" label="Video title" />
      <RenameDialog open={renameClassState.open} initialValue={renameClassState.session?.title || ''} onClose={closeRenameClass} onSubmit={submitRenameClass} submitting={renameClassState.saving} title="Rename lecture" label="Lecture title" />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={runConfirm}
        onClose={closeConfirm}
        confirming={confirmState.confirming}
      />
    </>
  );
}
