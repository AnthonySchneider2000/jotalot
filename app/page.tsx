'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiKeyInput } from '@/components/header/api-key-input';
import { CopilotStatus } from '@/components/header/copilot-status';
import { NoteEditor } from '@/components/editor/note-editor';
import { useGeminiCopilot } from '@/hooks/use-gemini-copilot';

export default function Home() {
  const [isValidApiKey, setIsValidApiKey] = useState(false);
  const copilot = useGeminiCopilot();

  const handleApiKeyChange = (apiKey: string) => {
    const success = copilot.initializeWithApiKey(apiKey);
    setIsValidApiKey(success);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold">jotalot</h1>
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
        <NoteEditor onApiKeyValidityChange={setIsValidApiKey} />
      </main>
    </div>
  );
}
