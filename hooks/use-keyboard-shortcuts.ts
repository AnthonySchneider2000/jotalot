import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    for (const shortcut of shortcuts) {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = (shortcut.ctrlKey ?? false) === event.ctrlKey;
      const altMatch = (shortcut.altKey ?? false) === event.altKey;
      const shiftMatch = (shortcut.shiftKey ?? false) === event.shiftKey;
      const metaMatch = (shortcut.metaKey ?? false) === event.metaKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action(event);
        break;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

export interface EditorShortcuts {
  onSelectWord: () => void;
  onSelectLine: () => void;
  onDeleteLine: () => void;
  onMoveLinesUp: () => void;
  onMoveLinesDown: () => void;
  onToggleComment: () => void;
  onDuplicate: () => void;
}

export function useEditorShortcuts(shortcuts: EditorShortcuts, enabled: boolean = true) {
  const keyboardShortcuts: KeyboardShortcut[] = [
    {
      key: 'd',
      ctrlKey: true,
      action: () => shortcuts.onSelectWord(),
    },
    {
      key: 'l',
      ctrlKey: true,
      action: () => shortcuts.onSelectLine(),
    },
    {
      key: 'k',
      ctrlKey: true,
      shiftKey: true,
      action: () => shortcuts.onDeleteLine(),
    },
    {
      key: 'ArrowUp',
      altKey: true,
      action: () => shortcuts.onMoveLinesUp(),
    },
    {
      key: 'ArrowDown',
      altKey: true,
      action: () => shortcuts.onMoveLinesDown(),
    },
    {
      key: '/',
      ctrlKey: true,
      action: () => shortcuts.onToggleComment(),
    },
    {
      key: 'd',
      ctrlKey: true,
      shiftKey: true,
      action: () => shortcuts.onDuplicate(),
    },
  ];

  useKeyboardShortcuts(keyboardShortcuts, enabled);
}
