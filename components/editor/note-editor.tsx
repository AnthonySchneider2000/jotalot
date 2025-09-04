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
    setContent(newContent);
    
    // Get cursor position and trigger copilot suggestion
    const cursorPosition = e.target.selectionStart;
    if (copilot.isEnabled && newContent.length > 0) {
      copilot.getSuggestion(newContent, cursorPosition);
    }
  }, [copilot]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab for copilot suggestion
    if (e.key === 'Tab' && copilot.suggestion) {
      e.preventDefault();
      const suggestion = copilot.acceptSuggestion();
      if (suggestion && textareaRef.current) {
        const textarea = textareaRef.current;
        const cursorPos = textarea.selectionStart;
        const newContent = content.slice(0, cursorPos) + suggestion + content.slice(cursorPos);
        setContent(newContent);
        
        // Set cursor position after the inserted suggestion
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPos + suggestion.length;
          textarea.focus();
        }, 0);
      }
      return;
    }

    // Handle Escape to dismiss copilot suggestion
    if (e.key === 'Escape' && copilot.suggestion) {
      e.preventDefault();
      copilot.dismissSuggestion();
      return;
    }
  }, [content, copilot]);

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
        <TextareaAutosize
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Start writing your notes..."
          className="jotalot-editor w-full h-full min-h-screen resize-none border-none outline-none focus:ring-0 p-6 bg-transparent"
          autoFocus
        />
        
        {/* Copilot suggestion overlay */}
        {copilot.suggestion && (
          <div className="copilot-suggestion absolute bottom-4 right-4 bg-background border rounded-lg p-3 shadow-lg max-w-sm">
            <div className="text-xs text-muted-foreground mb-1">Copilot suggestion:</div>
            <div className="text-sm font-mono bg-muted p-2 rounded text-muted-foreground">
              {copilot.suggestion}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Press Tab to accept, Esc to dismiss
            </div>
          </div>
        )}
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
