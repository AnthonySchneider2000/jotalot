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
  const [lastRequestText, setLastRequestText] = useState('');
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [rateLimitCooldownUntil, setRateLimitCooldownUntil] = useState(0);
  const [pendingRetryTimeout, setPendingRetryTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pendingRetryData, setPendingRetryData] = useState<{text: string, cursor: number} | null>(null);
  const [debouncedRequestText] = useDebounce(debouncedText, 500); // Increased from 500ms to 3s
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
      }
    };
  }, [pendingRetryTimeout]);

  // Handle debounced suggestion requests with rate limiting
  useEffect(() => {
    if (debouncedRequestText && state.isEnabled && !state.isLoading) {
      // Rate limiting: minimum 2 seconds between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      const MIN_REQUEST_INTERVAL = 2000; // 2 seconds

      // Check for rate limit cooldown period
      if (now < rateLimitCooldownUntil) {
        console.log(`Rate limit cooldown: ${rateLimitCooldownUntil - now}ms remaining`);
        return;
      }
      
      // Check if enough time has passed since last request
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const remainingTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`Rate limiting: ${remainingTime}ms until next request allowed`);
        
        // Schedule automatic retry if no retry is already pending
        if (!pendingRetryTimeout) {
          console.log(`⏰ Scheduling automatic retry in ${remainingTime}ms`);
          
          // Store the current request data for retry
          setPendingRetryData({ text: debouncedRequestText, cursor: debouncedRequestCursor });
          
          const timeoutId = setTimeout(() => {
            console.log(`🔄 Executing scheduled retry`);
            
            // Only retry if the text hasn't changed and there's no existing suggestion
            if (pendingRetryData && 
                pendingRetryData.text === debouncedRequestText && 
                pendingRetryData.cursor === debouncedRequestCursor &&
                !state.suggestion &&
                state.isEnabled &&
                !state.isLoading) {
              
              console.log(`✅ Conditions met, making retry request`);
              setLastRequestText(debouncedRequestText);
              setLastRequestTime(Date.now());
              getSuggestionInternal(debouncedRequestText, debouncedRequestCursor);
            } else {
              console.log(`❌ Retry cancelled - conditions not met (text changed: ${pendingRetryData?.text !== debouncedRequestText}, has suggestion: ${!!state.suggestion}, enabled: ${state.isEnabled}, loading: ${state.isLoading})`);
            }
            
            // Clear retry state
            setPendingRetryTimeout(null);
            setPendingRetryData(null);
          }, remainingTime);
          
          setPendingRetryTimeout(timeoutId);
        }
        
        return;
      }
      
      // // Check if text has changed significantly since last request
      // const textDifference = Math.abs(debouncedRequestText.length - lastRequestText.length);
      // const MIN_TEXT_CHANGE = 15; // Minimum 15 characters changed
      
      // if (textDifference < MIN_TEXT_CHANGE && lastRequestText.length > 0) {
      //   console.log(`Skipping suggestion: only ${textDifference} characters changed (minimum: ${MIN_TEXT_CHANGE})`);
      //   return;
      // }
      
      // // Check if we're at a good stopping point (word boundary)
      // const textBeforeCursor = debouncedRequestText.substring(0, debouncedRequestCursor);
      // const endsWithWordBoundary = /\s$/.test(textBeforeCursor) || /[.!?]\s*$/.test(textBeforeCursor);
      
      // if (!endsWithWordBoundary && textBeforeCursor.length > 20) {
      //   console.log('Skipping suggestion: not at word boundary');
      //   return;
      // }
      
      setLastRequestText(debouncedRequestText);
      setLastRequestTime(now);
      console.log('🤖 Making Gemini API request for suggestion...');
      getSuggestionInternal(debouncedRequestText, debouncedRequestCursor);
    }
  }, [debouncedRequestText, debouncedRequestCursor, state.isEnabled, state.isLoading, lastRequestText, lastRequestTime]);

  const initializeWithApiKey = useCallback((apiKey: string): boolean => {
    try {
      if (!apiKey || apiKey.trim().length === 0) {
        setState(prev => ({
          ...prev,
          isEnabled: false,
          error: 'API key is required'
        }));
        return false;
      }

      const success = geminiService.initialize(apiKey);
      storage.setGeminiApiKey(apiKey);
      
      setState(prev => ({
        ...prev,
        isEnabled: success,
        error: success ? null : 'Failed to initialize Gemini API - check your API key'
      }));
      
      return success;
    } catch (error) {
      console.error('Copilot initialization error:', error);
      setState(prev => ({
        ...prev,
        isEnabled: false,
        error: 'Invalid API key or connection error'
      }));
      return false;
    }
  }, []);

  const getSuggestionInternal = useCallback(async (text: string, cursorPosition: number) => {
    if (!state.isEnabled || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const suggestion = await geminiService.getSuggestion(text, cursorPosition);
      
      if (suggestion) {
        console.log('✅ Copilot suggestion received:', suggestion);
      } else {
        console.log('❌ No suggestion returned from API');
      }
      
      setState(prev => ({
        ...prev,
        suggestion,
        isLoading: false,
        error: null // Clear any previous errors on success
      }));
    } catch (error) {
      console.warn('Copilot suggestion failed, continuing without suggestions:', error);
      
      // Check if this is a rate limit error and set cooldown
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('quota')) {
        const cooldownDuration = 60000; // 60 seconds cooldown for rate limits
        setRateLimitCooldownUntil(Date.now() + cooldownDuration);
        console.log(`Rate limit detected, entering ${cooldownDuration / 1000}s cooldown period`);
        
        setState(prev => ({
          ...prev,
          suggestion: null,
          isLoading: false,
          error: 'Rate limit reached - suggestions paused for 1 minute'
        }));
      } else {
        setState(prev => ({
          ...prev,
          suggestion: null,
          isLoading: false,
          error: 'Suggestion service temporarily unavailable'
        }));
      }
    }
  }, [state.isEnabled, state.isLoading]);

  const getSuggestion = useCallback(async (text: string, cursorPosition: number) => {
    // Cancel any pending retry when new input is received
    if (pendingRetryTimeout) {
      console.log('🚫 Cancelling pending retry due to new input');
      clearTimeout(pendingRetryTimeout);
      setPendingRetryTimeout(null);
      setPendingRetryData(null);
    }
    
    // Update debounced values to trigger the effect
    setDebouncedText(text);
    setDebouncedCursor(cursorPosition);
  }, [pendingRetryTimeout]);

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
