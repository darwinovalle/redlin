import { createTheme } from '@mui/material/styles';

/**
 * RedLin brand theme — "The Neural Lab" (see DESIGN.md).
 *
 * The vivid brand hues (teal #20C997, purple #7F63F4) are reserved for
 * accent, selection, and non-text surfaces. Text-bearing surfaces use the
 * contrast-safe `dark` variants, which pass WCAG AA (≥4.5:1) against white
 * text: teal #0B7A54 (5.35:1), purple #5F47C9 (6.50:1).
 */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#20C997',
      dark: '#0B7A54',
      light: '#8BF0BF',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#7F63F4',
      dark: '#5F47C9',
      light: '#B8A8FA',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Titillium Web", "Poppins", Arial, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#0B7A54',
          '&:hover': { backgroundColor: '#0A6A4A' },
        },
        containedSecondary: {
          backgroundColor: '#5F47C9',
          '&:hover': { backgroundColor: '#5240B4' },
        },
      },
    },
  },
});
