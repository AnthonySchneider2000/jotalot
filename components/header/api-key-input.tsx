'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key, Check, X } from 'lucide-react';
import { useLocalStorageString } from '@/hooks/use-local-storage';

interface ApiKeyInputProps {
  onApiKeyChange: (apiKey: string) => void;
  isValidKey: boolean;
}

export function ApiKeyInput({ onApiKeyChange, isValidKey }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useLocalStorageString('jotalot_gemini_api_key');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(!apiKey);

  const handleSave = () => {
    onApiKeyChange(apiKey);
    setIsEditing(false);
  };

  const handleCancel = () => {
    const storedKey = window.localStorage.getItem('jotalot_gemini_api_key') || '';
    setApiKey(storedKey);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing && apiKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Key className="h-3 w-3" />
          {isValidKey ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <X className="h-3 w-3 text-red-500" />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-8 px-2 text-xs"
        >
          Edit API Key
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          type={showKey ? 'text' : 'password'}
          placeholder="Gemini API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={handleKeyPress}
          className="w-48 h-8 text-xs pr-8"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-0 top-0 h-8 w-8 p-0"
        >
          {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="h-8 px-2 text-xs"
          disabled={!apiKey.trim()}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-8 px-2 text-xs"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
