'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import TextareaAutosize from 'react-textarea-autosize';
import { storage } from '@/lib/storage';
import { useEditorShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useGeminiCopilot } from '@/hooks/use-gemini-copilot';

interface NoteEditorProps {
  onApiKeyValidityChange: (isValid: boolean) => void;
  onSaveStatusChange: (hasUnsavedChanges: boolean, lastSaved: Date | null) => void;
  onManualSaveRequest: React.MutableRefObject<(() => void) | null>;
}

export function NoteEditor({ onApiKeyValidityChange, onSaveStatusChange, onManualSaveRequest }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedContent, setSavedContent] = useState('');
  const [debouncedContent] = useDebounce(content, 3000);
  
  // Track suggestion state for intelligent management
  const [suggestionContext, setSuggestionContext] = useState<{
    originalContent: string;
    cursorPosition: number;
    suggestion: string;
  } | null>(null);

  // Track the display suggestion (what should be shown to user after partial typing)
  const [displaySuggestion, setDisplaySuggestion] = useState<string | null>(null);

  const copilot = useGeminiCopilot();

  // Load initial content
  useEffect(() => {
    const initialContent = storage.getNoteContent();
    setContent(initialContent);
    setSavedContent(initialContent);
    const savedTime = storage.getLastSaved();
    if (savedTime) {
      setLastSaved(new Date(savedTime));
    }
  }, []);

  // Auto-save debounced content
  useEffect(() => {
    if (debouncedContent !== undefined && debouncedContent !== savedContent) {
      storage.setNoteContent(debouncedContent);
      const now = new Date();
      setLastSaved(now);
      setSavedContent(debouncedContent);
    }
  }, [debouncedContent, savedContent]);

  // Update API key validity when copilot state changes
  useEffect(() => {
    onApiKeyValidityChange(copilot.isEnabled && !copilot.error);
  }, [copilot.isEnabled, copilot.error, onApiKeyValidityChange]);

  // Update save status when content or save state changes
  useEffect(() => {
    const hasUnsavedChanges = content !== savedContent;
    onSaveStatusChange(hasUnsavedChanges, lastSaved);
  }, [content, savedContent, lastSaved, onSaveStatusChange]);

  // Track when new suggestions are received to set context
  useEffect(() => {
    if (copilot.suggestion && !suggestionContext && textareaRef.current) {
      // New suggestion received - set the context
      const cursorPosition = textareaRef.current.selectionStart;
      setSuggestionContext({
        originalContent: content,
        cursorPosition: cursorPosition,
        suggestion: copilot.suggestion
      });
      setDisplaySuggestion(copilot.suggestion);
    } else if (!copilot.suggestion && suggestionContext) {
      // Suggestion was dismissed - clear context
      setSuggestionContext(null);
      setDisplaySuggestion(null);
    }
  }, [copilot.suggestion, suggestionContext, content]);

  // Manual save function
  const handleManualSave = useCallback(() => {
    if (content !== savedContent) {
      storage.setNoteContent(content);
      const now = new Date();
      setLastSaved(now);
      setSavedContent(content);
    }
  }, [content, savedContent]);

  // Handle manual save request from parent
  useEffect(() => {
    onManualSaveRequest.current = handleManualSave;
  }, [handleManualSave, onManualSaveRequest]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const newCursorPosition = e.target.selectionStart;
    
    setContent(newContent);
    
    // Intelligent suggestion management
    if (copilot.isEnabled && newContent.length > 0) {
      if (copilot.suggestion && suggestionContext) {
        // We have an existing suggestion - check if it's still valid
        const { originalContent, cursorPosition: originalCursor, suggestion } = suggestionContext;
        
        // Always dismiss suggestions if cursor moved backward or content length decreased
        if (newContent.length < originalContent.length || newCursorPosition < originalCursor) {
          // User backspaced or moved cursor back - dismiss suggestion
          copilot.dismissSuggestion();
          setSuggestionContext(null);
          setDisplaySuggestion(null);
        } else {
          // Check if user is typing characters that match the suggestion
          const typedSinceOriginal = newContent.slice(originalCursor, newCursorPosition);
          const contentBeforeOriginalCursor = newContent.slice(0, originalCursor);
          
          // Verify the content before the original cursor hasn't changed
          if (contentBeforeOriginalCursor !== originalContent.slice(0, originalCursor)) {
            // Content before cursor changed - dismiss suggestion
            copilot.dismissSuggestion();
            setSuggestionContext(null);
            setDisplaySuggestion(null);
          } else if (typedSinceOriginal.length > 0) {
            // User typed something - check if it matches the suggestion
            if (suggestion.startsWith(typedSinceOriginal)) {
              // Typed text matches suggestion beginning - update display to show remaining part
              const remainingSuggestion = suggestion.slice(typedSinceOriginal.length);
              if (remainingSuggestion.length > 0) {
                // Update display suggestion to show only the remaining part
                setDisplaySuggestion(remainingSuggestion);
                // Keep the original context - DON'T update it!
              } else {
                // User typed the entire suggestion - dismiss it
                copilot.dismissSuggestion();
                setSuggestionContext(null);
                setDisplaySuggestion(null);
              }
            } else {
              // Typed text doesn't match suggestion - dismiss it
              copilot.dismissSuggestion();
              setSuggestionContext(null);
              setDisplaySuggestion(null);
            }
          }
          // If no text was typed (just cursor movement), keep the suggestion as is
        }
      } else {
        // No existing suggestion - request a new one
        copilot.getSuggestion(newContent, newCursorPosition);
      }
    } else if (copilot.suggestion) {
      // Copilot disabled or content empty but suggestion exists - dismiss it
      copilot.dismissSuggestion();
      setSuggestionContext(null);
      setDisplaySuggestion(null);
    }
  }, [copilot, suggestionContext]);

  // Calculate precise cursor position using Canvas measureText
  const getCursorPosition = useCallback(() => {
    if (!textareaRef.current || !displaySuggestion) return null;
    
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    
    // Create a canvas to measure text width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Set font to match textarea exactly
    ctx.font = "16px 'Geist', 'Inter', system-ui, -apple-system, sans-serif";
    
    // Split text into lines to handle multi-line positioning
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex];
    
    // Measure width of text on current line
    const textWidth = ctx.measureText(currentLineText).width;
    
    // Calculate position (24px padding + measured width)
    const left = 24 + textWidth;
    const top = 24 + (currentLineIndex * 16 * 1.7); // line-height: 1.7, font-size: 16px
    
    return { left, top };
  }, [content, displaySuggestion]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab for copilot suggestion
    if (e.key === 'Tab' && displaySuggestion) {
      e.preventDefault();
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const newContent = content.slice(0, cursorPos) + displaySuggestion + content.slice(cursorPos);
        setContent(newContent);
        
        // Accept the suggestion in the copilot hook and clear our local state
        copilot.acceptSuggestion();
        setSuggestionContext(null);
        setDisplaySuggestion(null);
        
        // Set cursor position after the inserted suggestion
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPos + displaySuggestion.length;
          textarea.focus();
        }, 0);
      }
      return;
    }

    // Handle Escape to dismiss copilot suggestion
    if (e.key === 'Escape' && displaySuggestion) {
      e.preventDefault();
      copilot.dismissSuggestion();
      setSuggestionContext(null);
      setDisplaySuggestion(null);
      return;
    }
  }, [content, copilot, displaySuggestion]);

  // Editor shortcuts
  const getSelectionInfo = useCallback(() => {
    if (!textareaRef.current) return null;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    return { start, end, text, textarea };
  }, []);

  const selectCurrentWord = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const wordRegex = /\b\w+\b/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      if (match.index <= start && start <= match.index + match[0].length) {
        textarea.setSelectionRange(match.index, match.index + match[0].length);
        break;
      }
    }
  }, [getSelectionInfo]);

  const selectCurrentLine = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    
    textarea.setSelectionRange(lineStart, lineEnd === -1 ? text.length : lineEnd);
  }, [getSelectionInfo]);

  const deleteCurrentLine = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const endPos = lineEnd === -1 ? text.length : lineEnd + 1;
    
    const newContent = text.slice(0, lineStart) + text.slice(endPos);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = lineStart;
      textarea.focus();
    }, 0);
  }, [getSelectionInfo]);

  const moveLineUp = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const lines = text.split('\n');
    const currentLineIndex = text.substring(0, start).split('\n').length - 1;
    
    if (currentLineIndex > 0) {
      [lines[currentLineIndex - 1], lines[currentLineIndex]] = [lines[currentLineIndex], lines[currentLineIndex - 1]];
      const newContent = lines.join('\n');
      setContent(newContent);
      
      setTimeout(() => {
        const newPosition = start - lines[currentLineIndex].length - 1;
        textarea.selectionStart = textarea.selectionEnd = newPosition;
        textarea.focus();
      }, 0);
    }
  }, [getSelectionInfo]);

  const moveLineDown = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const lines = text.split('\n');
    const currentLineIndex = text.substring(0, start).split('\n').length - 1;
    
    if (currentLineIndex < lines.length - 1) {
      [lines[currentLineIndex], lines[currentLineIndex + 1]] = [lines[currentLineIndex + 1], lines[currentLineIndex]];
      const newContent = lines.join('\n');
      setContent(newContent);
      
      setTimeout(() => {
        const newPosition = start + lines[currentLineIndex + 1].length + 1;
        textarea.selectionStart = textarea.selectionEnd = newPosition;
        textarea.focus();
      }, 0);
    }
  }, [getSelectionInfo]);

  const toggleComment = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, end, text, textarea } = info;
    const selectedText = text.slice(start, end);
    const lines = selectedText.split('\n');
    
    const allCommented = lines.every(line => line.trim().startsWith('//') || line.trim() === '');
    
    const newLines = lines.map(line => {
      if (line.trim() === '') return line;
      if (allCommented) {
        return line.replace(/^(\s*)\/\/\s?/, '$1');
      } else {
        return line.replace(/^(\s*)/, '$1// ');
      }
    });
    
    const newContent = text.slice(0, start) + newLines.join('\n') + text.slice(end);
    setContent(newContent);
    
    setTimeout(() => {
      textarea.selectionStart = start;
      textarea.selectionEnd = start + newLines.join('\n').length;
      textarea.focus();
    }, 0);
  }, [getSelectionInfo]);

  const duplicateLine = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) return;
    
    const { start, text, textarea } = info;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
    
    const newContent = text.slice(0, lineEnd === -1 ? text.length : lineEnd) + '\n' + line + text.slice(lineEnd === -1 ? text.length : lineEnd);
    setContent(newContent);
    
    setTimeout(() => {
      const newPosition = lineEnd === -1 ? text.length + line.length + 1 : lineEnd + line.length + 1;
      textarea.selectionStart = textarea.selectionEnd = newPosition;
      textarea.focus();
    }, 0);
  }, [getSelectionInfo]);


  useEditorShortcuts({
    onSelectWord: selectCurrentWord,
    onSelectLine: selectCurrentLine,
    onDeleteLine: deleteCurrentLine,
    onMoveLinesUp: moveLineUp,
    onMoveLinesDown: moveLineDown,
    onToggleComment: toggleComment,
    onDuplicate: duplicateLine,
  });

  return (
    <div className="relative flex-1 flex flex-col h-full">
      <div className="flex-1 relative">
        {/* Absolute positioned suggestion overlay */}
        {displaySuggestion && (() => {
          const position = getCursorPosition();
          if (!position) return null;
          
          return (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                fontFamily: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
                fontSize: '16px',
                lineHeight: '1.7',
                color: 'var(--copilot-suggestion)',
                whiteSpace: 'pre',
                userSelect: 'none',
              }}
            >
              {displaySuggestion}
            </div>
          );
        })()}
        
        {/* Foreground layer for actual editing */}
        <TextareaAutosize
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Start writing your notes..."
          className="w-full h-full min-h-screen resize-none relative z-10 focus:outline-none focus:ring-0"
          style={{
            fontFamily: "'Geist', 'Inter', system-ui, -apple-system, sans-serif",
            fontSize: '16px',
            lineHeight: '1.7',
            letterSpacing: 'normal',
            padding: '24px',
            margin: '0',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'hsl(var(--foreground))',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            boxSizing: 'border-box',
            resize: 'none',
          }}
          autoFocus
        />
      </div>
      
      {/* Status bar */}
      <div className="border-t bg-muted/20 px-6 py-2 text-xs text-muted-foreground flex justify-between items-center">
        <div>
          {content.length} characters, {content.split('\n').length} lines
        </div>
        <div>
          {lastSaved && `Last saved: ${lastSaved.toLocaleTimeString()}`}
        </div>
      </div>
    </div>
  );
}
