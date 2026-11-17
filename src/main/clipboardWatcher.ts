import { clipboard } from 'electron';
import { ClipboardTracker } from '../shared/clipboardLogic';
import { ClipboardEntry } from '../shared/types';

export type ClipboardChangeListener = (entry: ClipboardEntry, history: ClipboardEntry[]) => void;

/**
 * Polls the OS clipboard for code copied from external IDEs and manages safe app-to-clipboard writes.
 */
export class ClipboardWatcher {
  private readonly tracker = new ClipboardTracker(15);
  private timer: NodeJS.Timeout | null = null;
  private enabled = true;
  private intervalMs = 350;
  private readonly listeners = new Set<ClipboardChangeListener>();

  onChange(listener: ClipboardChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  configure(enabled: boolean, intervalMs: number): void {
    const cleanInterval = Math.min(5000, Math.max(150, intervalMs));
    const needsRestart = this.enabled !== enabled || this.intervalMs !== cleanInterval;
    this.enabled = enabled;
    this.intervalMs = cleanInterval;

    if (needsRestart) {
      this.stop();
      if (this.enabled) {
        this.start();
      }
    }
  }

  start(): void {
    if (this.timer || !this.enabled) {
      return;
    }
    this.pollOnce();
    this.timer = setInterval(() => this.pollOnce(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pollOnce(): ClipboardEntry | null {
    try {
      const currentText = clipboard.readText();
      const entry = this.tracker.ingestFromSystem(currentText);
      if (entry) {
        const history = this.tracker.getHistory();
        for (const listener of this.listeners) {
          listener(entry, history);
        }
      }
      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Writes generated code into the OS clipboard so the user can paste it into their IDE,
   * without overwriting the app's captured IDE input preview.
   */
  writeOutputToClipboard(text: string): void {
    this.tracker.markSelfWrite(text);
    clipboard.writeText(text);
  }

  getLatestInput(): ClipboardEntry | null {
    return this.tracker.getLatestInput();
  }

  getHistory(): ClipboardEntry[] {
    return this.tracker.getHistory();
  }

  clearHistory(): void {
    this.tracker.clearHistory();
  }
}
