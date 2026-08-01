import React, { useState } from 'react';
import { useViewer } from './ViewerContext';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
// Highlight toggle removed
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export default function PdfToolbar() {
  const { state, dispatch } = useViewer();
  const [localSearch, setLocalSearch] = useState(state.searchTerm);

  const triggerSearch = () => {
    dispatch({ type: 'SET_SEARCH_TERM', term: localSearch.trim() });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 8px', borderBottom: '1px solid var(--color-black)',
      background: 'var(--color-black)', flexWrap: 'wrap'
    }}>
      {/* Zoom controls */}
      <Tooltip title="Zoom out"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_OUT' })}><ZoomOutIcon fontSize="small" sx={{ color: 'white' }} /></IconButton></Tooltip>
      <Tooltip title="Reset zoom"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_RESET' })}><RestartAltIcon fontSize="small" sx={{ color: 'white' }}/></IconButton></Tooltip>
      <Tooltip title="Zoom in"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_IN' })}><ZoomInIcon fontSize="small" sx={{ color: 'white' }}/></IconButton></Tooltip>
      <div style={{ fontSize: 12, color: 'var(--color-white)', minWidth: 60 }}>Zoom {(state.scale * 100).toFixed(0)}%</div>

      {/* Search box */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-ink-4)', padding: '2px 6px', borderRadius: 6, flex: '1 1 260px', maxWidth: 320 }}>
        <SearchIcon sx={{ fontSize: 16, color: 'var(--color-text-dim)', mr: 0.5 }} />
        <input
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-white)', fontSize: 13 }}
          placeholder="Search in document..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
        />
        {localSearch && (
          <IconButton size="small" onClick={() => { setLocalSearch(''); dispatch({ type: 'SET_SEARCH_TERM', term: '' }); }}>
            <ClearIcon sx={{ fontSize: 16, color: 'var(--color-text-faint)' }} />
          </IconButton>
        )}
        <IconButton size="small" onClick={triggerSearch}>
          <SearchIcon sx={{ fontSize: 16, color: 'var(--color-white)' }} />
        </IconButton>
      </div>
      {/* Search navigation */}
      {state.searchResults.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--color-white)', fontSize: 12 }}>
          <IconButton size="small" onClick={() => dispatch({ type: 'PREV_SEARCH_RESULT' })}><NavigateBeforeIcon sx={{ fontSize: 18, color: 'var(--color-white)' }} /></IconButton>
          <span>{state.currentSearchIndex + 1}/{state.searchResults.length}</span>
          <IconButton size="small" onClick={() => dispatch({ type: 'NEXT_SEARCH_RESULT' })}><NavigateNextIcon sx={{ fontSize: 18, color: 'var(--color-white)' }} /></IconButton>
        </div>
      )}
      {state.searchTerm && !state.searchResults.length && state.searchScanningPage > 0 && (
        <div style={{ color: 'var(--color-text-fainter)', fontSize: 11 }}>Scanning p.{state.searchScanningPage}/{state.numPages || '?'}...</div>
      )}

  <div style={{ flex: 1 }} />
    </div>
  );
}
