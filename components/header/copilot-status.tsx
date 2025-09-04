'use client';

import { Bot, BotOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CopilotStatusProps {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  hasSuggestion: boolean;
  onToggle: () => void;
}

export function CopilotStatus({ 
  isEnabled, 
  isLoading, 
  error, 
  hasSuggestion,
  onToggle 
}: CopilotStatusProps) {
  const getStatusColor = () => {
    if (error) return 'text-red-500';
    if (!isEnabled) return 'text-muted-foreground';
    if (isLoading) return 'text-blue-500';
    if (hasSuggestion) return 'text-green-500';
    return 'text-primary';
  };

  const getTooltipText = () => {
    if (error) return `Copilot Error: ${error}`;
    if (!isEnabled) return 'Copilot disabled - Click to enable';
    if (isLoading) return 'Copilot is thinking...';
    if (hasSuggestion) return 'Copilot suggestion available - Press Tab to accept';
    return 'Copilot enabled - Ready to help';
  };

  const getIcon = () => {
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (!isEnabled) return <BotOff className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className={`h-8 w-8 p-0 ${getStatusColor()}`}
          >
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
