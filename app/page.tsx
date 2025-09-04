'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiKeyInput } from '@/components/header/api-key-input';
import { CopilotStatus } from '@/components/header/copilot-status';
import { SaveStatus } from '@/components/header/save-status';
import { NoteEditor } from '@/components/editor/note-editor';
import { useGeminiCopilot } from '@/hooks/use-gemini-copilot';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export default function Home() {
  const [isValidApiKey, setIsValidApiKey] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const copilot = useGeminiCopilot();
  const manualSaveRef = useRef<(() => void) | null>(null);

  const handleApiKeyChange = (apiKey: string) => {
    const success = copilot.initializeWithApiKey(apiKey);
    setIsValidApiKey(success);
  };

  const handleSaveStatusChange = (unsavedChanges: boolean, savedTime: Date | null) => {
    setHasUnsavedChanges(unsavedChanges);
    setLastSaved(savedTime);
  };

  const handleManualSave = () => {
    if (manualSaveRef.current) {
      manualSaveRef.current();
    }
  };

  // Add Ctrl+S keyboard shortcut
  useKeyboardShortcuts([
    {
      key: 's',
      ctrlKey: true,
      action: (e) => {
        e.preventDefault();
        handleManualSave();
      },
    },
  ]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Save Controls */}
          <div className="flex items-center gap-3">
            <SaveStatus
              hasUnsavedChanges={hasUnsavedChanges}
              lastSaved={lastSaved}
              onManualSave={handleManualSave}
              isAutoSaveEnabled={true}
            />
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-semibold text-muted-foreground">jotalot</h1>
          </div>

          {/* Center: API Key Input */}
          <div className="flex-1 flex justify-center">
            <ApiKeyInput 
              onApiKeyChange={handleApiKeyChange}
              isValidKey={isValidApiKey}
            />
          </div>

          {/* Right: Status and Theme */}
          <div className="flex items-center gap-2">
            <CopilotStatus
              isEnabled={copilot.isEnabled}
              isLoading={copilot.isLoading}
              error={copilot.error}
              hasSuggestion={!!copilot.suggestion}
              onToggle={copilot.toggleCopilot}
            />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <main className="flex-1 overflow-hidden">
        <NoteEditor 
          onApiKeyValidityChange={setIsValidApiKey}
          onSaveStatusChange={handleSaveStatusChange}
          onManualSaveRequest={manualSaveRef}
        />
      </main>
    </div>
  );
}
