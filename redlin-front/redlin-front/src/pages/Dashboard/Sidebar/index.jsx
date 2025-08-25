import * as React from 'react';
import { styled } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '../../../theme';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { documentService } from '../../../services/api';
import { videoService } from '../../../services/api/video';
import AddSpaceModal from '../../../components/common/AddSpaceModal';
import { csvService } from '../../../services/api/csv';
import LoaderOverlay from '../../../components/common/LoaderOverlay';
import SuccessAlert from '../../../components/common/SuccessAlert';
import RenameDialog from '../../../components/common/RenameDialog';
import { useNavigate, useLocation } from 'react-router-dom';

const SIDEBAR_WIDTH = 288;
const SidebarShell = styled('div')(() => ({
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#1A2A3A', // solid dark per mock
  color: '#fff',
  fontFamily: 'AlibabaSans, sans-serif',
  borderRight: '1px solid rgba(255,255,255,0.08)',
  position: 'relative',
  zIndex: 10
}));
const NavItem = styled('div')(() => ({
  display: 'flex', alignItems: 'center', padding: '14px 24px', color: 'rgba(255,255,255,0.8)', fontSize: 16, cursor: 'pointer', position: 'relative', transition: 'background .25s,color .25s', userSelect: 'none', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }, '&.active': { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }
}));
const SectionTitle = styled('div')(() => ({ padding: '0 24px', margin: '16px 0 8px', fontSize: 12, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }));
const AddSpaceButton = styled('div')(() => ({ margin: '8px 24px', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', transition: 'background .25s', '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' } }));
const ItemIcon = styled('span')(() => ({ display: 'inline-flex', marginRight: 16, fontSize: 20, alignItems: 'center', justifyContent: 'center' }));
const HoverActions = styled('div')(() => ({ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', opacity: 0, transition: 'opacity .2s' }));
const NestedList = styled('div')(() => ({ paddingLeft: 8 }));
const UserProfile = styled('div')(() => ({ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }));
const Avatar = styled('div')(() => ({ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#4A90E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12, fontWeight: 500, fontSize: 14 }));

export default function MiniDrawer({ selectedDocumentId, onDocumentSelect, onDocumentDelete, onLogout, onOpenSettings }) {
  const [loading, setLoading] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname.startsWith('/home');
  const currentDocSlug = React.useMemo(() => { const m = location.pathname.match(/^\/documents\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const currentCsvSlug = React.useMemo(() => { const m = location.pathname.match(/^\/csv\/([^/?#]+)/); return m?decodeURIComponent(m[1]):null; }, [location.pathname]);
  const docsOpenKey = React.useMemo(()=> user?.id?`sidebar:${user.id}:docsOpen`:null,[user?.id]);
  const sheetsOpenKey = React.useMemo(()=> user?.id?`sidebar:${user.id}:sheetsOpen`:null,[user?.id]);
  const kanbanOpenKey = React.useMemo(()=> user?.id?`sidebar:${user.id}:kanbanOpen`:null,[user?.id]);
  const videosOpenKey = React.useMemo(()=> user?.id?`sidebar:${user.id}:videosOpen`:null,[user?.id]);
  const statsOpenKey = React.useMemo(()=> user?.id?`sidebar:${user.id}:statsOpen`:null,[user?.id]);
  const [userDocuments,setUserDocuments]=useState([]);
  const [loadingDocs,setLoadingDocs]=useState(false);
  const [fetchError,setFetchError]=useState(null);
  const [csvImports,setCsvImports]=useState([]);
  const [videos,setVideos]=useState([]);
  const [loadingVideos,setLoadingVideos]=useState(false);
  const [videoError,setVideoError]=useState(null);
  const [creatingVideo,setCreatingVideo]=useState(false);
  const [docsOpen,setDocsOpen]=useState(()=>{ if(docsOpenKey){try{const v=localStorage.getItem(docsOpenKey); if(v==='true'||v==='false') return v==='true';}catch{}} return !isHome;});
  const [sheetsOpen,setSheetsOpen]=useState(()=>{ if(sheetsOpenKey){try{const v=localStorage.getItem(sheetsOpenKey); if(v==='true'||v==='false') return v==='true';}catch{}} return false;});
  const [kanbanOpen,setKanbanOpen]=useState(()=>{ if(kanbanOpenKey){try{const v=localStorage.getItem(kanbanOpenKey); if(v==='true'||v==='false') return v==='true';}catch{}} return false;});
  const [videosOpen,setVideosOpen]=useState(()=>{ if(videosOpenKey){try{const v=localStorage.getItem(videosOpenKey); if(v==='true'||v==='false') return v==='true';}catch{}} return false;});
  const [statsOpen,setStatsOpen]=useState(()=>{ if(statsOpenKey){try{const v=localStorage.getItem(statsOpenKey); if(v==='true'||v==='false') return v==='true';}catch{}} return false;});
  const [openSampleModal,setOpenSampleModal]=useState(false);
  const [renameState,setRenameState]=useState({open:false,doc:null,saving:false});
  const [renameSheetState,setRenameSheetState]=useState({open:false,imp:null,saving:false});
  const [error,setError]=useState(null);
  const slugify = (str)=> (str||'').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
  const fetchUserDocuments=async()=>{ if(!user?.id){setUserDocuments([]);return;} setLoadingDocs(true); setFetchError(null); try{ const docs=await documentService.getUserDocuments(user.id); setUserDocuments(docs);}catch(e){ setFetchError(e?.message||'Could not load documents'); } finally { setLoadingDocs(false);} };
  const uploadFile=async(file)=>{ if(!file||!user?.id) return; setLoading(true); setError(null); try{ await documentService.uploadDocument(file,user.id); await fetchUserDocuments(); setSuccessAlertOpen(true);}catch(e){ setError(e?.error||'Upload failed'); } finally { setLoading(false);} };
  const handleDeleteDocument=async(doc)=>{ if(!window.confirm('Delete this document?')) return; try{ await documentService.deleteDocument(doc.id); setUserDocuments(d=>d.filter(x=>x.id!==doc.id)); if(currentDocSlug && slugify(doc.title||String(doc.id))===currentDocSlug) navigate('/home'); }catch{ alert('Failed to delete'); } };
  const handleDeleteSheet=async(imp)=>{ if(!window.confirm('Delete this sheet?')) return; try{ await csvService.deleteImport(imp.id); setCsvImports(s=>s.filter(x=>x.id!==imp.id)); }catch{ alert('Failed to delete sheet'); } };
  useEffect(()=>{ if(!docsOpenKey)return; try{const v=localStorage.getItem(docsOpenKey); if(v==='true'||v==='false') setDocsOpen(v==='true');}catch{} },[docsOpenKey]);
  useEffect(()=>{ if(docsOpenKey) try{localStorage.setItem(docsOpenKey,String(docsOpen));}catch{} },[docsOpen,docsOpenKey]);
  useEffect(()=>{ if(!sheetsOpenKey)return; try{const v=localStorage.getItem(sheetsOpenKey); if(v==='true'||v==='false') setSheetsOpen(v==='true');}catch{} },[sheetsOpenKey]);
  useEffect(()=>{ if(sheetsOpenKey) try{localStorage.setItem(sheetsOpenKey,String(sheetsOpen));}catch{} },[sheetsOpen,sheetsOpenKey]);
  useEffect(()=>{ if(!kanbanOpenKey)return; try{const v=localStorage.getItem(kanbanOpenKey); if(v==='true'||v==='false') setKanbanOpen(v==='true');}catch{} },[kanbanOpenKey]);
  useEffect(()=>{ if(kanbanOpenKey) try{localStorage.setItem(kanbanOpenKey,String(kanbanOpen));}catch{} },[kanbanOpen,kanbanOpenKey]);
  useEffect(()=>{ if(!videosOpenKey)return; try{const v=localStorage.getItem(videosOpenKey); if(v==='true'||v==='false') setVideosOpen(v==='true');}catch{} },[videosOpenKey]);
  useEffect(()=>{ if(videosOpenKey) try{localStorage.setItem(videosOpenKey,String(videosOpen));}catch{} },[videosOpen,videosOpenKey]);
  useEffect(()=>{ if(!statsOpenKey)return; try{const v=localStorage.getItem(statsOpenKey); if(v==='true'||v==='false') setStatsOpen(v==='true');}catch{} },[statsOpenKey]);
  useEffect(()=>{ if(statsOpenKey) try{localStorage.setItem(statsOpenKey,String(statsOpen));}catch{} },[statsOpen,statsOpenKey]);
  useEffect(()=>{ fetchUserDocuments(); (async()=>{ try{ const data=await csvService.listImports(); setCsvImports(Array.isArray(data)?data:[]);}catch{ setCsvImports([]);} })(); (async()=>{ if(!user){ setVideos([]); return;} setLoadingVideos(true); setVideoError(null); try{ const list=await videoService.listVideos(); setVideos(Array.isArray(list)?list:[]);}catch{ setVideoError('Could not load videos'); } finally { setLoadingVideos(false);} })(); },[user]);
  const openRename=(doc)=> setRenameState({open:true,doc,saving:false});
  const closeRename=()=> setRenameState({open:false,doc:null,saving:false});
  const submitRename=async(newTitle)=>{ if(!renameState.doc) return; try{ setRenameState(s=>({...s,saving:true})); await documentService.renameDocument(renameState.doc.id,newTitle); setUserDocuments(d=>d.map(x=>x.id===renameState.doc.id?{...x,title:newTitle}:x)); closeRename(); }catch(e){ setError(e?.error||'Rename failed'); setRenameState(s=>({...s,saving:false})); } };
  const openRenameSheet=(imp)=> setRenameSheetState({open:true,imp,saving:false});
  const closeRenameSheet=()=> setRenameSheetState({open:false,imp:null,saving:false});
  const submitRenameSheet=async(newName)=>{ if(!renameSheetState.imp) return; try{ setRenameSheetState(s=>({...s,saving:true})); await csvService.renameImport(renameSheetState.imp.id,newName); setCsvImports(d=>d.map(i=>i.id===renameSheetState.imp.id?{...i,filename:newName}:i)); closeRenameSheet(); }catch(e){ setError(e?.error||'Rename failed'); setRenameSheetState(s=>({...s,saving:false})); } };
  const handleCreateVideo=async({url,languages})=>{ if(!url) return; setCreatingVideo(true); try{ const v=await videoService.createVideo({url,languages}); setVideos(prev=>[v,...prev]); setOpenSampleModal(false); navigate(`/videos/${v.id}`);}catch(e){ alert(e?.response?.data?.error||'Failed to add video'); } finally { setCreatingVideo(false);} };
  return (
    <ThemeProvider theme={darkTheme}>
      <LoaderOverlay open={loading} text="Uploading..." />
      <SuccessAlert open={successAlertOpen} message="Your file was successfully processed." onClose={()=>setSuccessAlertOpen(false)} autoHideDuration={5000} />
      <CssBaseline />
      <SidebarShell>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, display: 'flex', alignItems: 'center', fontWeight: 600 }}>
            <span style={{ marginRight: 12, fontSize: 28, color: '#20C997', display: 'inline-flex' }}>🧠</span>
            AI Learn
          </h2>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          <div className="nav-section" style={{ marginBottom:24 }}>
            <NavItem className={isHome?'active':''} onClick={()=>navigate('/home')}>
              <ItemIcon><HomeIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span>Home</span>
            </NavItem>
            <NavItem onClick={()=>setDocsOpen(v=>!v)} className={docsOpen?'active':''}>
              <ItemIcon><FolderIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Study Documents</span>
              {docsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={docsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {loadingDocs && <Typography sx={{ px:3, py:1, color:'rgba(255,255,255,0.6)' }}>Loading documents...</Typography>}
                {fetchError && <Typography sx={{ px:3, py:1, color:'#ff6b6b' }}>Error: {fetchError}</Typography>}
                {!loadingDocs && !fetchError && userDocuments.length===0 && user && <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'rgba(255,255,255,0.6)' }}>No documents yet.</Typography>}
                {userDocuments.map(doc=>{ const active = selectedDocumentId===doc.id || (currentDocSlug && slugify(doc.title||String(doc.id))===currentDocSlug); return (
                  <NavItem key={doc.id} className={active?'active':''} style={{ paddingLeft:40 }}
                    onClick={()=>{ const slug=slugify(doc.title||String(doc.id)); try{ localStorage.setItem('lastDocSlug', slug);}catch{} navigate(`/documents/${slug}`); onDocumentSelect?.(doc.id); }}
                    onMouseEnter={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='1';}}
                    onMouseLeave={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='0';}}
                  >
                    <ItemIcon><InsertDriveFileIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.title}</span>
                    <HoverActions className="hover-actions">
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); openRename(doc);}} sx={{ color:'rgba(255,255,255,0.7)' }}><EditIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); handleDeleteDocument(doc);}} sx={{ color:'#ff6b6b' }}><DeleteIcon fontSize="inherit" /></IconButton>
                    </HoverActions>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
            <NavItem onClick={()=>setVideosOpen(v=>!v)} className={videosOpen?'active':''}>
              <ItemIcon><OndemandVideoIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Videos</span>
              {videosOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={videosOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {loadingVideos && <Typography sx={{ px:3, py:1, color:'rgba(255,255,255,0.6)' }}>Loading videos...</Typography>}
                {videoError && <Typography sx={{ px:3, py:1, color:'#ff6b6b' }}>{videoError}</Typography>}
                {!loadingVideos && !videoError && videos.length===0 && <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'rgba(255,255,255,0.6)' }}>No videos yet.</Typography>}
                {videos.map(v=> (
                  <NavItem key={v.id} style={{ paddingLeft:40 }} onClick={()=>navigate(`/videos/${v.id}`)}>
                    <ItemIcon><OndemandVideoIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.title||v.video_id||'Video '+v.id}</span>
                    <span style={{ fontSize:11, opacity:0.6 }}>{v.processing_status}</span>
                  </NavItem>
                ))}
              </NestedList>
            </Collapse>
          </div>
          <div className="nav-section">
            <NavItem onClick={()=>setSheetsOpen(v=>!v)} className={sheetsOpen?'active':''}>
              <ItemIcon><DescriptionIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Study Sheets</span>
              {sheetsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={sheetsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                {csvImports.length===0 ? <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'rgba(255,255,255,0.6)' }}>No sheets yet.</Typography> : csvImports.map(imp=>{ const name=(imp.filename||'csv').replace(/\.[^/.]+$/, ''); const slug=slugify(name); const active=currentCsvSlug && slug===currentCsvSlug; return (
                  <NavItem key={imp.id} className={active?'active':''} style={{ paddingLeft:40 }}
                    onClick={()=>navigate(`/csv/${slug}?importId=${imp.id}`)}
                    onMouseEnter={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='1';}}
                    onMouseLeave={e=>{const a=e.currentTarget.querySelector('.hover-actions'); if(a)a.style.opacity='0';}}
                  >
                    <ItemIcon><DescriptionIcon sx={{ fontSize:18 }} /></ItemIcon>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</span>
                    <HoverActions className="hover-actions">
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); openRenameSheet(imp);}} sx={{ color:'rgba(255,255,255,0.7)' }}><EditIcon fontSize="inherit" /></IconButton>
                      <IconButton size="small" onClick={(e)=>{e.stopPropagation(); handleDeleteSheet(imp);}} sx={{ color:'#ff6b6b' }}><DeleteIcon fontSize="inherit" /></IconButton>
                    </HoverActions>
                  </NavItem>
                );})}
              </NestedList>
            </Collapse>
          </div>
          <div className="nav-section">
            <NavItem onClick={()=>setKanbanOpen(v=>!v)} className={kanbanOpen?'active':''}>
              <ItemIcon><ViewKanbanIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Kanban Tasks</span>
              {kanbanOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={kanbanOpen} timeout="auto" unmountOnExit>
              <NestedList>
                <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'rgba(255,255,255,0.6)' }}>No tasks yet.</Typography>
              </NestedList>
            </Collapse>
          </div>
          <div className="nav-section">
            <NavItem onClick={()=>setStatsOpen(v=>!v)} className={statsOpen?'active':''}>
              <ItemIcon><BarChartIcon sx={{ fontSize:20 }} /></ItemIcon>
              <span style={{ flex:1 }}>Stats</span>
              {statsOpen? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </NavItem>
            <Collapse in={statsOpen} timeout="auto" unmountOnExit>
              <NestedList>
                <Typography sx={{ px:3, py:1, fontStyle:'italic', color:'rgba(255,255,255,0.6)' }}>No stats yet.</Typography>
              </NestedList>
            </Collapse>
          </div>
          <AddSpaceButton onClick={()=>setOpenSampleModal(true)}>
            <AddIcon sx={{ fontSize:18, mr:1 }} />
            <span>Add Space</span>
          </AddSpaceButton>
          <SectionTitle>Settings</SectionTitle>
          <NavItem onClick={()=>navigate('/pricing')}><ItemIcon><WorkspacePremiumIcon sx={{ fontSize:20 }}/></ItemIcon><span>Upgrade Plan</span></NavItem>
          <NavItem onClick={()=>onOpenSettings?.()}><ItemIcon><SettingsIcon sx={{ fontSize:20 }}/></ItemIcon><span>Settings</span></NavItem>
          <NavItem onClick={onLogout}><ItemIcon><LogoutIcon sx={{ fontSize:20 }}/></ItemIcon><span>Logout</span></NavItem>
        </div>
        <UserProfile>
          <Avatar>{(user?.username || user?.email || 'U?').slice(0,2).toUpperCase()}</Avatar>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:500, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.username || user?.email || 'User'}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.email || ''}</div>
          </div>
        </UserProfile>
      </SidebarShell>
      <AddSpaceModal
        open={openSampleModal}
        onClose={()=>setOpenSampleModal(false)}
        onImportDocument={async(file)=>{ await uploadFile(file); setOpenSampleModal(false); }}
        onImportSheet={async(file)=>{ try{ const res=await csvService.uploadCSV(file); setOpenSampleModal(false); const name=(file?.name||'csv').replace(/\.[^/.]+$/, ''); const slug=slugify(name); navigate(`/csv/${slug}?importId=${res?.import?.id||''}`);}catch(e){ console.error('CSV import failed',e); alert('CSV import failed'); } }}
        onCreateTutorial={()=>{ console.log('Create tutorial'); setOpenSampleModal(false);} }
        onCreateKanban={()=>{ console.log('Create kanban'); setOpenSampleModal(false);} }
        onCreateVideo={handleCreateVideo}
        creatingVideo={creatingVideo}
      />
      <RenameDialog open={renameState.open} initialValue={renameState.doc?.title || ''} onClose={closeRename} onSubmit={submitRename} submitting={renameState.saving} />
      <RenameDialog open={renameSheetState.open} initialValue={(renameSheetState.imp?.filename || '').replace(/\.[^/.]+$/, '')} onClose={closeRenameSheet} onSubmit={submitRenameSheet} submitting={renameSheetState.saving} title="Rename Sheet" label="Sheet name" />
    </ThemeProvider>
  );
}
