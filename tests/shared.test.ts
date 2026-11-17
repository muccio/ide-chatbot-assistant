import { describe, expect, it } from 'vitest';
import { normalizeChatbotUrl, isAllowedNavigationUrl } from '../src/shared/urlUtils';
import { buildCodingPrompt } from '../src/shared/promptBuilder';
import { ClipboardTracker } from '../src/shared/clipboardLogic';
import { clampOpacity, calculateWebViewBounds } from '../src/shared/layoutMath';
import { sanitizeCodeBlocks } from '../src/shared/codeExtractor';
import { DEFAULT_PRESETS } from '../src/shared/defaults';

describe('urlUtils', () => {
  it('normalizes bare domains to https://', () => {
    expect(normalizeChatbotUrl('chatgpt.com')).toBe('https://chatgpt.com/');
    expect(normalizeChatbotUrl('  gemini.google.com/app  ')).toBe('https://gemini.google.com/app');
  });

  it('normalizes localhost and 127.0.0.1 to http://', () => {
    expect(normalizeChatbotUrl('localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeChatbotUrl('127.0.0.1:8080/chat')).toBe('http://127.0.0.1:8080/chat');
  });

  it('keeps explicit http/https URLs and rejects unsafe schemes', () => {
    expect(normalizeChatbotUrl('https://claude.ai/new')).toBe('https://claude.ai/new');
    expect(normalizeChatbotUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeChatbotUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeChatbotUrl('')).toBeNull();
  });

  it('validates allowed navigation URLs including about:blank', () => {
    expect(isAllowedNavigationUrl('https://chat.deepseek.com')).toBe(true);
    expect(isAllowedNavigationUrl('http://localhost:11434')).toBe(true);
    expect(isAllowedNavigationUrl('about:blank')).toBe(true);
    expect(isAllowedNavigationUrl('file:///tmp/test.html')).toBe(false);
  });
});

describe('promptBuilder', () => {
  it('builds a structured prompt from operating parameters and code', () => {
    const preset = {
      ...DEFAULT_PRESETS[0],
      role: 'Senior TypeScript Engineer',
      targetLanguage: 'TypeScript',
      outputMode: 'code-only' as const,
      customRules: 'No placeholders.',
      prefix: 'CONTESTO PROGETTO:',
      suffix: 'FINE CODICE.',
    };

    const result = buildCodingPrompt({
      preset,
      code: 'const x: any = 1;',
      action: 'refactor',
      userInstruction: 'Rimuovi any',
    });

    expect(result).toContain('Senior TypeScript Engineer');
    expect(result).toContain('TypeScript');
    expect(result).toContain('Rispondi SOLO con il codice');
    expect(result).toContain('No placeholders.');
    expect(result).toContain('CONTESTO PROGETTO:');
    expect(result).toContain('Refactoring');
    expect(result).toContain('Rimuovi any');
    expect(result).toContain('```typescript\nconst x: any = 1;\n```');
    expect(result).toContain('FINE CODICE.');
  });

  it('handles empty code gracefully when only user instruction is given', () => {
    const result = buildCodingPrompt({
      preset: DEFAULT_PRESETS[0],
      code: '   ',
      action: 'send',
      userInstruction: 'Scrivi una funzione sum(a, b)',
    });

    expect(result).toContain('Scrivi una funzione sum(a, b)');
    expect(result).not.toContain('```');
  });
});

describe('ClipboardTracker', () => {
  it('records new IDE clipboard entries and ignores duplicates', () => {
    const tracker = new ClipboardTracker(3);
    const first = tracker.ingestFromSystem('const a = 1;');
    expect(first?.text).toBe('const a = 1;');

    const dup = tracker.ingestFromSystem('const a = 1;');
    expect(dup).toBeNull();

    const second = tracker.ingestFromSystem('const b = 2;');
    expect(second?.text).toBe('const b = 2;');
    expect(tracker.getHistory()).toHaveLength(2);
  });

  it('ignores clipboard text recently written by app output copy without losing IDE input', () => {
    const tracker = new ClipboardTracker(5);
    tracker.ingestFromSystem('function buggy() {}');
    expect(tracker.getLatestInput()?.text).toBe('function buggy() {}');

    tracker.markSelfWrite('function fixed() {}');
    const selfRead = tracker.ingestFromSystem('function fixed() {}');
    expect(selfRead).toBeNull();
    expect(tracker.getLatestInput()?.text).toBe('function buggy() {}');
  });

  it('caps history to maxEntries', () => {
    const tracker = new ClipboardTracker(2);
    tracker.ingestFromSystem('one');
    tracker.ingestFromSystem('two');
    tracker.ingestFromSystem('three');
    expect(tracker.getHistory().map((e) => e.text)).toEqual(['three', 'two']);
  });
});

describe('layoutMath', () => {
  it('clamps opacity between 0.25 and 1.0', () => {
    expect(clampOpacity(0)).toBe(0.25);
    expect(clampOpacity(0.1)).toBe(0.25);
    expect(clampOpacity(0.75)).toBe(0.75);
    expect(clampOpacity(1.4)).toBe(1);
    expect(clampOpacity(Number.NaN)).toBe(1);
  });

  it('calculates WebContentsView bounds with and without open sidebar', () => {
    const withSidebar = calculateWebViewBounds({
      contentWidth: 1200,
      contentHeight: 800,
      topBarHeight: 54,
      statusBarHeight: 26,
      sidebarOpen: true,
      sidebarWidth: 360,
    });
    expect(withSidebar).toEqual({ x: 360, y: 54, width: 840, height: 720 });

    const collapsed = calculateWebViewBounds({
      contentWidth: 1200,
      contentHeight: 800,
      topBarHeight: 54,
      statusBarHeight: 26,
      sidebarOpen: false,
      sidebarWidth: 360,
    });
    expect(collapsed).toEqual({ x: 0, y: 54, width: 1200, height: 720 });
  });
});

describe('codeExtractor', () => {
  it('sanitizes, trims, removes UI button prefixes, and deduplicates code blocks', () => {
    const blocks = sanitizeCodeBlocks([
      { language: 'ts', code: 'Copy code\nconst x = 1;\nconst y = 2;\n' },
      { language: 'ts', code: 'const x = 1;\nconst y = 2;' },
      { language: 'text', code: '   ' },
      { language: 'python', code: 'def hi():\n    return "ok"' },
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('ts');
    expect(blocks[0].code).toBe('const x = 1;\nconst y = 2;');
    expect(blocks[0].lineCount).toBe(2);
    expect(blocks[1].language).toBe('python');
  });
});
