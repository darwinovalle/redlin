import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';

// Reusable 3-dot kebab menu (Rename / optional Add image / Delete). The Add image
// option only renders when onAddImage is provided.
const ItemMenu = ({ onRename, onDelete, onAddImage, addImageLabel = 'Add image' }) => {
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
        {onAddImage && (
          <MenuItem onClick={(e) => { e.stopPropagation(); handleClose(); onAddImage?.(); }} sx={{ fontSize: 14, '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-white) 8%, transparent)' } }}>
          {addImageLabel}
        </MenuItem>
        )}
        <MenuItem onClick={(e) => { e.stopPropagation(); handleClose(); onDelete?.(); }} sx={{ fontSize: 14, color: 'var(--color-danger-soft)', '&:hover': { backgroundColor: 'color-mix(in srgb, var(--color-danger-softer) 14%, transparent)' } }}>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
};

export default ItemMenu;