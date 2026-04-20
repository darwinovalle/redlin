import { createContext, useContext, useState } from 'react';

const FlashcardContext = createContext();

async function parseFetchPayload(response) {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text || null;
}

async function fetchRequest(url, { method = 'GET', data, headers, ...options } = {}) {
  const requestHeaders = new Headers(headers || {});
  let body;

  if (data !== undefined) {
    if (data instanceof FormData || data instanceof URLSearchParams || typeof data === 'string') {
      body = data;
    } else {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      body = JSON.stringify(data);
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    ...options,
  });

  const payload = await parseFetchPayload(response);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.detail || `Request failed with status ${response.status}`);
    error.response = { status: response.status, data: payload };
    throw error;
  }

  return payload;
}

export const FlashcardProvider = ({ children }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [pdfSummary, setPdfSummary] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); 
  const [showResults, setShowResults] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const placeholderFlashcards = [
    {
      id: 'placeholder-1',
      question: 'How many valves in the human heart?',
      answer: 'There are four valves: tricuspid, pulmonary, mitral, and aortic.',
      options: ['Two', 'Three', 'Four', 'Five'], 
      correctOption: 2, 
      image: 'https://via.placeholder.com/150/FFFFFF/000000?text=Heart+Image', 
    },
    {
      id: 'placeholder-2',
      question: 'What is the powerhouse of the cell?',
      answer: 'Mitochondria',
      options: [],
      correctOption: 0,
      image: null,
    },
    {
      id: 'placeholder-3',
      question: 'What is H2O?',
      answer: 'Water',
      options: [],
      correctOption: 0,
      image: null,
    },
  ];

  const displayFlashcards = flashcards.length > 0 ? flashcards : placeholderFlashcards;

  const createFlashcard = async (cardData) => {
    try {
      const data = await fetchRequest('/api/flashcards', {
        method: 'POST',
        data: cardData,
      });
      setFlashcards(prev => [...prev, data]);
    } catch (error) {
      console.error('Error creating flashcard:', error);
      throw error;
    }
  };

  const updateFlashcard = async (id, updatedData) => {
    try {
      const data = await fetchRequest(`/api/flashcards/${id}`, {
        method: 'PUT',
        data: updatedData,
      });
      setFlashcards(prev => 
        prev.map(card => card.id === id ? data : card)
      );
    } catch (error) {
      console.error('Error updating flashcard:', error);
      throw error;
    }
  };

  const deleteFlashcard = async (id) => {
    try {
      await fetchRequest(`/api/flashcards/${id}`, { method: 'DELETE' });
      setFlashcards(prev => prev.filter(card => card.id !== id));
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      throw error;
    }
  };

  const startQuiz = () => {
    // Check displayFlashcards to be consistent with UI logic
    if (displayFlashcards.length === 0) { 
      alert("Please add some flashcards before starting the quiz.");
      return;
    }
    setQuizMode(true);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowResults(false);
  };

  const submitAnswer = (questionId, selectedOptionIndex) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: selectedOptionIndex }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < flashcards.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const finishQuiz = () => {
    setQuizMode(false);
    setShowResults(true);
  };

  const endQuiz = () => { 
    setQuizMode(false);
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
  }

  const nextCard = () => {
    setCurrentCardIndex((prevIndex) =>
      prevIndex < displayFlashcards.length - 1 ? prevIndex + 1 : prevIndex
    );
  };

  const previousCard = () => {
    setCurrentCardIndex((prevIndex) =>
      prevIndex > 0 ? prevIndex - 1 : prevIndex
    );
  };

  const importPDF = async (file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    try {
      const data = await fetchRequest('/api/pdf/import', {
        method: 'POST',
        data: formData,
      });
      setFlashcards(data.flashcards);
      setPdfSummary(data.summary);
    } catch (error) {
      console.error('Error importing PDF:', error);
      throw error;
    }
  };

  return (
    <FlashcardContext.Provider
      value={{
        flashcards,
        selectedCard,
        setSelectedCard,
        quizMode,
        setQuizMode,
        pdfSummary,
        currentQuestionIndex,
        userAnswers,
        showResults,
        currentCardIndex,
        displayFlashcards,
        createFlashcard,
        updateFlashcard,
        deleteFlashcard,
        startQuiz,
        submitAnswer,
        nextQuestion,
        previousQuestion,
        finishQuiz, 
        endQuiz, 
        nextCard,
        previousCard,
        importPDF
      }}
    >
      {children}
    </FlashcardContext.Provider>
  );
};

export const useFlashcard = () => {
  const context = useContext(FlashcardContext);
  if (context === undefined) {
    throw new Error('useFlashcard must be used within a FlashcardProvider');
  }
  return context;
};
