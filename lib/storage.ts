export interface NoteData {
  content: string;
  lastSaved: number;
}

export interface UserPreferences {
  fontSize: number;
  autoSave: boolean;
  copilotEnabled: boolean;
}

export interface AppStorage {
  noteContent: string;
  geminiApiKey: string;
  lastSaved: number;
  userPreferences: UserPreferences;
}

const STORAGE_KEYS = {
  NOTE_CONTENT: 'jotalot_note_content',
  GEMINI_API_KEY: 'jotalot_gemini_api_key',
  LAST_SAVED: 'jotalot_last_saved',
  USER_PREFERENCES: 'jotalot_user_preferences',
} as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  fontSize: 16,
  autoSave: true,
  copilotEnabled: true,
};

export const storage = {
  // Note content
  getNoteContent(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEYS.NOTE_CONTENT) || '';
  },

  setNoteContent(content: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.NOTE_CONTENT, content);
    localStorage.setItem(STORAGE_KEYS.LAST_SAVED, Date.now().toString());
  },

  // API Key
  getGeminiApiKey(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
  },

  setGeminiApiKey(apiKey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, apiKey);
  },

  // Last saved timestamp
  getLastSaved(): number {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(STORAGE_KEYS.LAST_SAVED);
    return saved ? parseInt(saved, 10) : 0;
  },

  // User preferences
  getUserPreferences(): UserPreferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!stored) return DEFAULT_PREFERENCES;
    
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  setUserPreferences(preferences: Partial<UserPreferences>): void {
    if (typeof window === 'undefined') return;
    const current = this.getUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
  },

  // Clear all data
  clearAll(): void {
    if (typeof window === 'undefined') return;
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};
