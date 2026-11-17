import { ClipboardEntry } from './types';

function createEntryId(timestamp: number, length: number): string {
  return `clip-${timestamp}-${length}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Tracks system clipboard changes from the user's IDE while ignoring writes performed by the app itself.
 */
export class ClipboardTracker {
  private readonly maxEntries: number;
  private history: ClipboardEntry[] = [];
  private lastSeenSystemText: string | null = null;
  private ignoredSelfWriteText: string | null = null;

  constructor(maxEntries = 12) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  /**
   * Marks text as written by the app itself so the next poll does not overwrite the IDE input preview.
   */
  markSelfWrite(text: string): void {
    this.ignoredSelfWriteText = text;
    this.lastSeenSystemText = text;
  }

  /**
   * Processes a system clipboard snapshot and returns a new ClipboardEntry if it represents new IDE input.
   */
  ingestFromSystem(rawText: string, timestamp = Date.now()): ClipboardEntry | null {
    if (!rawText || !rawText.trim()) {
      return null;
    }

    if (this.ignoredSelfWriteText !== null && rawText === this.ignoredSelfWriteText) {
      this.ignoredSelfWriteText = null;
      this.lastSeenSystemText = rawText;
      return null;
    }

    if (rawText === this.lastSeenSystemText) {
      return null;
    }

    this.lastSeenSystemText = rawText;
    const normalized = rawText.replace(/\r\n/g, '\n');
    const entry: ClipboardEntry = {
      id: createEntryId(timestamp, normalized.length),
      text: normalized,
      timestamp,
      lineCount: normalized.split('\n').length,
      charCount: normalized.length,
    };

    this.history = [entry, ...this.history.filter((item) => item.text !== normalized)].slice(0, this.maxEntries);
    return entry;
  }

  getLatestInput(): ClipboardEntry | null {
    return this.history[0] ?? null;
  }

  getHistory(): ClipboardEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.lastSeenSystemText = null;
  }
}
