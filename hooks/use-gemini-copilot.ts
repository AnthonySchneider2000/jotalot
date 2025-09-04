import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { geminiService } from '@/lib/gemini-api';
import { storage } from '@/lib/storage';

export interface CopilotState {
  suggestion: string | null;
  isLoading: boolean;
  isEnabled: boolean;
  error: string | null;
}

export interface CopilotHookReturn extends CopilotState {
  initializeWithApiKey: (apiKey: string) => boolean;
  getSuggestion: (text: string, cursorPosition: number) => Promise<void>;
  acceptSuggestion: () => string | null;
  dismissSuggestion: () => void;
  toggleCopilot: () => void;
}

export function useGeminiCopilot(): CopilotHookReturn {
  const [state, setState] = useState<CopilotState>({
    suggestion: null,
    isLoading: false,
    isEnabled: false,
    error: null,
  });

  const [debouncedText, setDebouncedText] = useState('');
  const [debouncedCursor, setDebouncedCursor] = useState(0);
  const [debouncedRequestText] = useDebounce(debouncedText, 500);
  const [debouncedRequestCursor] = useDebounce(debouncedCursor, 500);

  // Initialize copilot on mount
  useEffect(() => {
    const apiKey = storage.getGeminiApiKey();
    const preferences = storage.getUserPreferences();
    
    if (apiKey && preferences.copilotEnabled) {
      const initialized = geminiService.initialize(apiKey);
      setState(prev => ({
        ...prev,
        isEnabled: initialized,
        error: initialized ? null : 'Failed to initialize Gemini API'
      }));
    }
  }, []);

  // Handle debounced suggestion requests
  useEffect(() => {
    if (debouncedRequestText && state.isEnabled && !state.isLoading) {
      getSuggestionInternal(debouncedRequestText, debouncedRequestCursor);
    }
  }, [debouncedRequestText, debouncedRequestCursor, state.isEnabled, state.isLoading]);

  const initializeWithApiKey = useCallback((apiKey: string): boolean => {
    try {
      const success = geminiService.initialize(apiKey);
      storage.setGeminiApiKey(apiKey);
      
      setState(prev => ({
        ...prev,
        isEnabled: success,
        error: success ? null : 'Failed to initialize Gemini API'
      }));
      
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isEnabled: false,
        error: 'Invalid API key or network error'
      }));
      return false;
    }
  }, []);

  const getSuggestionInternal = useCallback(async (text: string, cursorPosition: number) => {
    if (!state.isEnabled || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const suggestion = await geminiService.getSuggestion(text, cursorPosition);
      setState(prev => ({
        ...prev,
        suggestion,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        suggestion: null,
        isLoading: false,
        error: 'Failed to get suggestion'
      }));
    }
  }, [state.isEnabled, state.isLoading]);

  const getSuggestion = useCallback(async (text: string, cursorPosition: number) => {
    // Update debounced values to trigger the effect
    setDebouncedText(text);
    setDebouncedCursor(cursorPosition);
  }, []);

  const acceptSuggestion = useCallback((): string | null => {
    const suggestion = state.suggestion;
    setState(prev => ({ ...prev, suggestion: null }));
    return suggestion;
  }, [state.suggestion]);

  const dismissSuggestion = useCallback(() => {
    setState(prev => ({ ...prev, suggestion: null }));
  }, []);

  const toggleCopilot = useCallback(() => {
    const newEnabled = !state.isEnabled;
    setState(prev => ({ ...prev, isEnabled: newEnabled, suggestion: null }));
    
    const preferences = storage.getUserPreferences();
    storage.setUserPreferences({ ...preferences, copilotEnabled: newEnabled });
  }, [state.isEnabled]);

  return {
    ...state,
    initializeWithApiKey,
    getSuggestion,
    acceptSuggestion,
    dismissSuggestion,
    toggleCopilot,
  };
}
