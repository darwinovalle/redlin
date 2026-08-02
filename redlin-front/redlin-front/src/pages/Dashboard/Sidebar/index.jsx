import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import BarChartIcon from '@mui/icons-material/BarChart';
import HomeIcon from '@mui/icons-material/Home';
import DeleteIcon from '@mui/icons-material/Delete';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import EditIcon from '@mui/icons-material/Edit';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import AddIcon from '@mui/icons-material/Add';
import SchoolIcon from '@mui/icons-material/School';
import MicIcon from '@mui/icons-material/Mic';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { documentService } from '../../../services/api';
import { videoService } from '../../../services/api/video';
import { classroomService } from '../../../services/api/classroom';
import AddSpaceModal from '../../../components/common/AddSpaceModal';
import { csvService } from '../../../services/api/csv';
import LoaderOverlay from '../../../components/common/LoaderOverlay';
import SuccessAlert from '../../../components/common/SuccessAlert';
import RenameDialog from '../../../components/common/RenameDialog';
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
const AddSpaceButton = styled('button')(() => ({ width: '100%', margin: '8px 24px', padding: '10px 16px', backgroundColor: 'color-mix(in srgb, var(--color-white) 10%, transparent)', border: '1px dashed color-mix(in srgb, var(--color-white) 30%, transparent)', borderRadius: 6, color: 'var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', transition: 'background .25s', fontFamily: 'inherit', '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-white) 15%, transparent)' }, '&:focus-visible': { outline: '2px solid var(--color-teal)', outlineOffset: '-2px' } }));
const ItemIcon = styled('span')(() => ({ display: 'inline-flex', marginRight: 16, fontSize: 20, alignItems: 'center', justifyContent: 'center' }));
const HoverActions = styled('div')(() => ({ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', opacity: 0, transition: 'opacity .2s' }));
const NestedList = styled('div')(() => ({ paddingLeft: 8 }));
const UserProfile = styled('div')(() => ({ padding: '16px 24px', borderTop: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', display: 'flex', alignItems: 'center' }));
const Avatar = styled('div')(() => ({ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontWeight: 500, fontSize: 14 }));

export default function MiniDrawer({ selectedDocumentId, onDocumentSelect, onDocumentDelete, onLogout, onOpenSettings }) {
  const [loading, setLoading] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname.startsWith('/home');
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
  const [creatingVideo,setCreatingVideo]=useState(false);
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
  const [openSampleModal,setOpenSampleModal]=useState(false);
  const [renameState,setRenameState]=useState({open:false,doc:null,saving:false});
  const [renameSheetState,setRenameSheetState]=useState({open:false,imp:null,saving:false});
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
        setClassroomError(e?.message || 'Could not load classroom spaces');                                                                                   
      } finally {                                                                                                                                             
        setLoadingClassroomSessions(false);                                                                                                                   
      }                                                                                                                                                       
    }; 
  const uploadFile=async(file)=>{ if(!file||!user?.id) return; setLoading(true); setError(null); try{ await documentService.uploadDocument(file,user.id); await fetchUserDocuments(); setSuccessAlertOpen(true);}catch(e){ setError(e?.error||'Upload failed'); } finally { setLoading(false);} };
  const handleDeleteDocument=async(doc)=>{ if(!window.confirm('Delete this document?')) return; try{ await documentService.deleteDocument(doc.id); setUserDocuments(d=>d.filter(x=>x.id!==doc.id)); if(currentDocSlug && slugify(doc.title||String(doc.id))===currentDocSlug) navigate('/home'); }catch{ alert('Failed to delete'); } };
  const handleDeleteSheet=async(imp)=>{ if(!window.confirm('Delete this sheet?')) return; try{ await csvService.deleteImport(imp.id); setCsvImports(s=>s.filter(x=>x.id!==imp.id)); }catch{ alert('Failed to delete sheet'); } };
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
  const handleCreateVideo=async({url,languages})=>{ if(!url) return; setCreatingVideo(true); try{ const v=await videoService.createVideo({url,languages}); setVideos(prev=>[v,...prev]); setOpenSampleModal(false); navigate(`/videos/${v.id}`);}catch(e){ alert(e?.response?.data?.error||'Failed to add video'); } finally { setCreatingVideo(false);} };
  const handleCreateClassroom=async({title,language})=>{
    const trimmedTitle = (title || '').trim();
    if(!trimmedTitle) return;
    try{
      const session = await classroomService.createSession({ title: trimmedTitle, language: language || 'es' });
      await fetchClassroomSessions();
      setClassroomOpen(true);
      setOpenSampleModal(false);
      if(session?.id){
        navigate(`/classroom/${session.id}`);
      }
    }catch(e){
      alert(e?.response?.data?.error || e?.message || 'Failed to create classroom space');
    }
  };
  const sidebarContent = (
    <>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid color-mix(in srgb, var(--color-white) 10%, transparent)', marginBottom: 24 }}>
          <div style={{ display:'flex', alignItems:'center', height:64 }}>
            <div style={{ width:40, height:40, background:'linear-gradient(135deg,var(--color-teal),var(--color-blue))', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', marginRight:12, boxShadow:'0 0 20px color-mix(in srgb, var(--color-teal) 30%, transparent)' }}>
              <i className="ri-brain-line" style={{ fontSize:22, color:'var(--color-white)' }} />
            </div>
            <span style={{ fontSize:24, fontWeight:700, background:'linear-gradient(90deg,var(--color-white),var(--color-text-muted-on-dark))', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>Redlin</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          <div className="nav-section" style={{ marginBottom:24 }}>
            <NavItem type="button" className={isHome?'active':''} onClick={()=>navigate('/home')}>
              <ItemIcon><HomeIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span>Home</span>
            </NavItem>
            <NavItem type="button" onClick={()=>setClassroomOpen(v=>!v)} className={classroomOpen?'active':''}>
              <ItemIcon><SchoolIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Classroom Spaces</span>
              {classroomOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={classroomOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {loadingClassroomSessions && <Typography sx={{ px:3, py:1, color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Loading classrooms...</Typography>}
                {classroomError && <Typography sx={{ px:3, py:1, color:'var(--color-danger-soft)' }}>{classroomError}</Typography>}
                {!loadingClassroomSessions && !classroomError && classroomSessions.length===0 && <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No classroom spaces yet.</Typography>}
                {classroomSessions.map((session)=> { const active = currentClassroomSessionId && String(session.id)===currentClassroomSessionId; return (
                  <NavItem type="button" key={session.id} className={active?'active':''} style={{ paddingLeft:40 }} onClick={()=>navigate(`/classroom/${session.id}`)}>
                    <ItemIcon><MicIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{session.title}</span>
                    <span style={{ fontSize:11, opacity:0.6 }}>{session.status}</span>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
            <NavItem type="button" onClick={()=>setDocsOpen(v=>!v)} className={docsOpen?'active':''}>
              <ItemIcon><FolderIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Study Documents</span>
              {docsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={docsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {loadingDocs && <Typography sx={{ px:3, py:1, color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Loading documents...</Typography>}
                {fetchError && <Typography sx={{ px:3, py:1, color:'var(--color-danger-soft)' }}>Error: {fetchError}</Typography>}
                {!loadingDocs && !fetchError && userDocuments.length===0 && user && <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No documents yet.</Typography>}
                {userDocuments.map(doc=>{ const active = selectedDocumentId===doc.id || (currentDocSlug && slugify(doc.title||String(doc.id))===currentDocSlug); return (
                  <NavItem type="button" key={doc.id} className={active?'active':''} style={{ paddingLeft:40 }}
                    onClick={()=>{ const slug=slugify(doc.title||String(doc.id)); try{ localStorage.setItem('lastDocSlug', slug);}catch{} navigate(`/documents/${slug}`); onDocumentSelect?.(doc.id); }}
                    onMouseEnter={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='1';}}
                    onMouseLeave={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='0';}}
                  >
                    <ItemIcon><InsertDriveFileIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.title}</span>
                    <HoverActions className="hover-actions">
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); openRename(doc);}} sx={{ color:'color-mix(in srgb, var(--color-white) 70%, transparent)' }}><EditIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); handleDeleteDocument(doc);}} sx={{ color:'var(--color-danger-soft)' }}><DeleteIcon fontSize="inherit" /></IconButton>
                    </HoverActions>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
            <NavItem type="button" onClick={()=>setVideosOpen(v=>!v)} className={videosOpen?'active':''}>
              <ItemIcon><OndemandVideoIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Videos</span>
              {videosOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={videosOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {loadingVideos && <Typography sx={{ px:3, py:1, color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>Loading videos...</Typography>}
                {videoError && <Typography sx={{ px:3, py:1, color:'var(--color-danger-soft)' }}>{videoError}</Typography>}
                {!loadingVideos && !videoError && videos.length===0 && <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No videos yet.</Typography>}
                {videos.map(v=> { const active = currentVideoId && String(v.id)===currentVideoId; return (
                  <NavItem type="button" key={v.id} className={active?'active':''} style={{ paddingLeft:40 }} onClick={()=>navigate(`/videos/${v.id}`)}>
                    <ItemIcon><OndemandVideoIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.title||v.video_id||'Video '+v.id}</span>
                    <span style={{ fontSize:11, opacity:0.6 }}>{v.processing_status}</span>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
          </div>
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
            <NavItem type="button" onClick={()=>setKanbanOpen(v=>!v)} className={kanbanOpen?'active':''}>
              <ItemIcon><ViewKanbanIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Kanban Tasks</span>
              {kanbanOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={kanbanOpen} timeout="auto" unmountOnExit>
              <NestedList>
                <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No tasks yet.</Typography>
              </NestedList>
            </Collapse>
          </div>
          <div className="nav-section">
            <NavItem type="button" onClick={()=>setStatsOpen(v=>!v)} className={statsOpen?'active':''}>
              <ItemIcon><BarChartIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Stats</span>
              {statsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={statsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'color-mix(in srgb, var(--color-white) 60%, transparent)' }}>No stats yet.</Typography>
              </NestedList>
            </Collapse>
          </div>
          <AddSpaceButton type="button" onClick={()=>setOpenSampleModal(true)}>
            <AddIcon sx={{ fontSize:18, mr:1 }} />
            <span>Add Space</span>
          </AddSpaceButton>
          <SectionTitle>Settings</SectionTitle>
          {/* TODO: Re-enable when SaaS/Stripe launches — see MVP scope.
          <NavItem type="button" onClick={()=>navigate('/pricing')}><ItemIcon><WorkspacePremiumIcon sx={{ fontSize:20 }}/></ItemIcon><span>Upgrade Plan</span></NavItem> */}

          <NavItem type="button" onClick={()=>onOpenSettings?.()}><ItemIcon><SettingsIcon sx={{ fontSize:20 }}/></ItemIcon><span>Settings</span></NavItem>
          <NavItem type="button" onClick={onLogout}><ItemIcon><LogoutIcon sx={{ fontSize:20 }}/></ItemIcon><span>Logout</span></NavItem>
        </div>
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

      <AddSpaceModal
        open={openSampleModal}
        onClose={()=>setOpenSampleModal(false)}
        onImportDocument={async(file)=>{ await uploadFile(file); setOpenSampleModal(false); }}
        onImportSheet={async(file)=>{ try{ const res=await csvService.uploadCSV(file); setOpenSampleModal(false); const name=(file?.name||'csv').replace(/\.[^/.]+$/, ''); const slug=slugify(name); navigate(`/csv/${slug}?importId=${res?.import?.id||''}`);}catch(e){ console.error('CSV import failed',e); alert('CSV import failed'); } }}
        onCreateClassroom={handleCreateClassroom}
        onCreateTutorial={()=>{ console.log('Create tutorial'); setOpenSampleModal(false);} }
        onCreateKanban={()=>{ console.log('Create kanban'); setOpenSampleModal(false);} }
        onCreateVideo={handleCreateVideo}
        creatingVideo={creatingVideo}
      />
      <RenameDialog open={renameState.open} initialValue={renameState.doc?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} />
      <RenameDialog open={renameSheetState.open} initialValue={(renameSheetState.imp?.filename || '').replace(/\.[^/.]+$/, '')} onClose={closeRenameSheet} onSubmit={submitRenameSheet} submitting={renameSheetState.saving} title="Rename Sheet" label="Sheet name" />
    </>
  );
}
