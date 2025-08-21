import React from 'react';
import { useViewer } from './ViewerContext';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HighlightIcon from '@mui/icons-material/Highlight';

export default function PdfToolbar() {
  const { state, dispatch } = useViewer();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 8px', borderBottom: '1px solid #000000',
      background: '#000000'
    }}>
      <Tooltip title="Zoom out"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_OUT' })}><ZoomOutIcon fontSize="small" sx={{ color: 'white' }} /></IconButton></Tooltip>
      <Tooltip title="Reset zoom"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_RESET' })}><RestartAltIcon fontSize="small" sx={{ color: 'white' }}/></IconButton></Tooltip>
      <Tooltip title="Zoom in"><IconButton size="small" onClick={() => dispatch({ type: 'ZOOM_IN' })}><ZoomInIcon fontSize="small" sx={{ color: 'white' }}/></IconButton></Tooltip>
      <div style={{ marginLeft: 8, fontSize: 12 }}>Zoom: {(state.scale * 100).toFixed(0)}%</div>
      <div style={{ flex: 1 }} />
      <Tooltip title={state.highlightMode ? 'Exit highlight mode' : 'Enter highlight mode'}>
        <IconButton size="small" color={state.highlightMode ? 'primary' : 'default'} onClick={() => dispatch({ type: 'TOGGLE_HIGHLIGHT' })}>
          <HighlightIcon fontSize="small" sx={{ color: 'white'}}/>
        </IconButton>
      </Tooltip>
    </div>
  );
}
