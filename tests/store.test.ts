import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigStore } from '../src/main/store';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'chatbot-store-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('ConfigStore', () => {
  it('initializes with default config when file does not exist', () => {
    const dir = createTempDir();
    const store = new ConfigStore(join(dir, 'config.json'));
    const cfg = store.getConfig();

    expect(cfg.providers.length).toBeGreaterThanOrEqual(8);
    expect(cfg.presets.length).toBeGreaterThanOrEqual(3);
    expect(cfg.window.alwaysOnTop).toBe(true);
    expect(cfg.window.opacity).toBe(0.96);
  });

  it('persists provider additions and removals without deleting built-in providers', () => {
    const dir = createTempDir();
    const filePath = join(dir, 'config.json');
    const store = new ConfigStore(filePath);

    const added = store.addCustomProvider('My Local LLM', 'localhost:11434');
    expect(added?.url).toBe('http://localhost:11434/');

    const reloaded = new ConfigStore(filePath);
    expect(reloaded.getConfig().providers.some((p) => p.name === 'My Local LLM')).toBe(true);

    const removedBuiltin = reloaded.removeProvider('gemini');
    expect(removedBuiltin).toBe(false);

    const removedCustom = reloaded.removeProvider(added!.id);
    expect(removedCustom).toBe(true);
    expect(reloaded.getConfig().providers.some((p) => p.id === added!.id)).toBe(false);
  });

  it('recovers gracefully from corrupted JSON config on disk', () => {
    const dir = createTempDir();
    const filePath = join(dir, 'config.json');
    writeFileSync(filePath, '{not valid json', 'utf8');

    const store = new ConfigStore(filePath);
    expect(store.getConfig().activeProviderId).toBe('gemini');
  });

  it('clamps opacity and saves operating presets', () => {
    const dir = createTempDir();
    const filePath = join(dir, 'config.json');
    const store = new ConfigStore(filePath);

    store.updateWindowSettings({ opacity: 0.05, alwaysOnTop: false });
    expect(store.getConfig().window.opacity).toBe(0.25);
    expect(store.getConfig().window.alwaysOnTop).toBe(false);

    const saved = store.upsertPreset({
      id: 'custom-rust',
      name: 'Rust Expert',
      role: 'Rust systems engineer',
      targetLanguage: 'Rust',
      outputMode: 'code-only',
      customRules: 'Use Result<T, E>',
      prefix: '',
      suffix: '',
    });
    expect(saved.id).toBe('custom-rust');

    const reloaded = new ConfigStore(filePath);
    expect(reloaded.getConfig().presets.some((p) => p.id === 'custom-rust')).toBe(true);
  });
});
