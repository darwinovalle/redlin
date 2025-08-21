import React, { createContext, useContext, useReducer } from 'react';

const ViewerContext = createContext(null);

const initialState = {
  scale: 1.3,
  page: 1,
  numPages: 0,
  highlightMode: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.page };
    case 'SET_NUM_PAGES':
      return { ...state, numPages: action.numPages };
    case 'ZOOM_IN':
      return { ...state, scale: Math.min(3, +(state.scale + 0.1).toFixed(2)) };
    case 'ZOOM_OUT':
      return { ...state, scale: Math.max(0.5, +(state.scale - 0.1).toFixed(2)) };
    case 'ZOOM_RESET':
      return { ...state, scale: 1.0 };
    case 'TOGGLE_HIGHLIGHT':
      return { ...state, highlightMode: !state.highlightMode };
    default:
      return state;
  }
}

export function ViewerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <ViewerContext.Provider value={{ state, dispatch }}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error('useViewer must be used within ViewerProvider');
  return ctx;
}
