import React, { createContext, useContext, useReducer } from 'react';

const ViewerContext = createContext(null);

const initialState = {
  scale: 1.3,
  page: 1,
  numPages: 0,
  // highlightMode removed from UI; kept for backward compatibility but unused
  highlightMode: false,
  searchTerm: '',
  searchResults: [], // array of page numbers containing the term
  currentSearchIndex: 0, // index inside searchResults
  searchScanningPage: 0, // progressive scanning indicator
  searchJobId: null, // cancel token
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
      return state; // no-op now
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.term, currentSearchIndex: 0 };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results, currentSearchIndex: 0 };
    case 'NEXT_SEARCH_RESULT': {
      if (!state.searchResults.length) return state;
      const nextIdx = (state.currentSearchIndex + 1) % state.searchResults.length;
      return { ...state, currentSearchIndex: nextIdx, page: state.searchResults[nextIdx] };
    }
    case 'PREV_SEARCH_RESULT': {
      if (!state.searchResults.length) return state;
      const prevIdx = (state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length;
      return { ...state, currentSearchIndex: prevIdx, page: state.searchResults[prevIdx] };
    }
    case 'SEARCH_INIT':
      return { ...state, searchJobId: action.jobId, searchScanningPage: 0, searchResults: [], currentSearchIndex: 0 };
    case 'SEARCH_PROGRESS':
      return { ...state, searchScanningPage: action.page };
    case 'SEARCH_ADD_HIT': {
      if (state.searchResults.includes(action.page)) return state;
      const results = [...state.searchResults, action.page].sort((a,b)=>a-b);
      const firstNewIndex = results.indexOf(action.page);
      return {
        ...state,
        searchResults: results,
        currentSearchIndex: state.searchResults.length ? state.currentSearchIndex : firstNewIndex,
        page: state.searchResults.length ? state.page : action.page,
      };
    }
    case 'SEARCH_COMPLETE':
      return { ...state, searchJobId: null, searchScanningPage: 0 };
    case 'SEARCH_CANCEL':
      return { ...state, searchJobId: null, searchScanningPage: 0 };
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
