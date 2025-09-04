'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Check, Clock, AlertCircle } from 'lucide-react';

interface SaveStatusProps {
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  onManualSave: () => void;
  isAutoSaveEnabled: boolean;
}

export function SaveStatus({ 
  hasUnsavedChanges, 
  lastSaved, 
  onManualSave,
  isAutoSaveEnabled 
}: SaveStatusProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastSaved) {
        setTimeAgo('Never saved');
        return;
      }

      const now = new Date();
      const diffMs = now.getTime() - lastSaved.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);

      if (diffSeconds < 60) {
        setTimeAgo('Just now');
      } else if (diffMinutes < 60) {
        setTimeAgo(`${diffMinutes}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
      } else {
        setTimeAgo(lastSaved.toLocaleDateString());
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [lastSaved]);

  const getSaveIcon = () => {
    if (hasUnsavedChanges) {
      return <Clock className="h-4 w-4 text-amber-500" />;
    }
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getSaveTooltip = () => {
    if (hasUnsavedChanges) {
      return `Unsaved changes • ${timeAgo}${isAutoSaveEnabled ? ' • Auto-save in progress' : ''}`;
    }
    return `All changes saved • ${timeAgo}`;
  };

  const getManualSaveTooltip = () => {
    if (hasUnsavedChanges) {
      return 'Save now (Ctrl+S)';
    }
    return 'No changes to save';
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onManualSave}
              disabled={!hasUnsavedChanges}
              className="h-8 w-8 p-0"
            >
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getManualSaveTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {getSaveIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{getSaveTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
