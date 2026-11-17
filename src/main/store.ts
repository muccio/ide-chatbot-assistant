import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_PRESETS, DEFAULT_PROVIDERS } from '../shared/defaults';
import { clampOpacity } from '../shared/layoutMath';
import {
  AppConfig,
  ChatbotProvider,
  OperatingPreset,
  SessionSettings,
  WindowSettings,
} from '../shared/types';
import { normalizeChatbotUrl } from '../shared/urlUtils';

function cloneDefaults(): AppConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
}

/**
 * Persists application configuration, chatbot providers, operating presets, and window/session state as JSON.
 */
export class ConfigStore {
  private readonly filePath: string;
  private config: AppConfig;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.config = this.loadFromDisk();
  }

  private loadFromDisk(): AppConfig {
    const base = cloneDefaults();
    if (!existsSync(this.filePath)) {
      return base;
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;

      const customProviders = Array.isArray(parsed.providers)
        ? parsed.providers.filter((p) => p && !p.builtIn && typeof p.id === 'string' && typeof p.url === 'string')
        : [];

      const presets =
        Array.isArray(parsed.presets) && parsed.presets.length > 0
          ? parsed.presets
          : DEFAULT_PRESETS;

      const mergedWindow: WindowSettings = {
        ...base.window,
        ...(parsed.window ?? {}),
        opacity: clampOpacity(parsed.window?.opacity ?? base.window.opacity),
        bounds: {
          ...base.window.bounds,
          ...(parsed.window?.bounds ?? {}),
        },
      };

      const mergedSession: SessionSettings = {
        ...base.session,
        ...(parsed.session ?? {}),
      };

      return {
        activeProviderId: parsed.activeProviderId ?? base.activeProviderId,
        activeUrl: parsed.activeUrl ?? base.activeUrl,
        providers: [...DEFAULT_PROVIDERS, ...customProviders],
        activePresetId: parsed.activePresetId ?? presets[0].id,
        presets,
        session: mergedSession,
        window: mergedWindow,
      };
    } catch {
      return base;
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)) as AppConfig;
  }

  setActiveTarget(url: string, providerId?: string): AppConfig {
    this.config.activeUrl = url;
    if (providerId !== undefined) {
      this.config.activeProviderId = providerId;
    }
    this.save();
    return this.getConfig();
  }

  addCustomProvider(name: string, rawUrl: string): ChatbotProvider | null {
    const cleanName = name.trim();
    const normalizedUrl = normalizeChatbotUrl(rawUrl);
    if (!cleanName || !normalizedUrl) {
      return null;
    }

    const provider: ChatbotProvider = {
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      url: normalizedUrl,
      builtIn: false,
    };

    this.config.providers.push(provider);
    this.save();
    return provider;
  }

  removeProvider(id: string): boolean {
    const target = this.config.providers.find((p) => p.id === id);
    if (!target || target.builtIn) {
      return false;
    }

    this.config.providers = this.config.providers.filter((p) => p.id !== id);
    if (this.config.activeProviderId === id) {
      this.config.activeProviderId = DEFAULT_PROVIDERS[0].id;
      this.config.activeUrl = DEFAULT_PROVIDERS[0].url;
    }
    this.save();
    return true;
  }

  setActivePreset(presetId: string): AppConfig {
    if (this.config.presets.some((p) => p.id === presetId)) {
      this.config.activePresetId = presetId;
      this.save();
    }
    return this.getConfig();
  }

  upsertPreset(preset: OperatingPreset): OperatingPreset {
    const sanitized: OperatingPreset = {
      ...preset,
      id: preset.id.trim() || `preset-${Date.now().toString(36)}`,
      name: preset.name.trim() || 'Preset Personalizzato',
    };

    const existingIdx = this.config.presets.findIndex((p) => p.id === sanitized.id);
    if (existingIdx >= 0) {
      this.config.presets[existingIdx] = sanitized;
    } else {
      this.config.presets.push(sanitized);
    }

    this.config.activePresetId = sanitized.id;
    this.save();
    return sanitized;
  }

  deletePreset(presetId: string): boolean {
    if (this.config.presets.length <= 1) {
      return false;
    }
    const next = this.config.presets.filter((p) => p.id !== presetId);
    if (next.length === this.config.presets.length) {
      return false;
    }
    this.config.presets = next;
    if (this.config.activePresetId === presetId) {
      this.config.activePresetId = next[0].id;
    }
    this.save();
    return true;
  }

  updateSessionSettings(patch: Partial<SessionSettings>): AppConfig {
    this.config.session = {
      ...this.config.session,
      ...patch,
      zoomFactor: Math.min(1.8, Math.max(0.6, patch.zoomFactor ?? this.config.session.zoomFactor)),
      clipboardPollIntervalMs: Math.min(
        5000,
        Math.max(150, patch.clipboardPollIntervalMs ?? this.config.session.clipboardPollIntervalMs),
      ),
    };
    this.save();
    return this.getConfig();
  }

  updateWindowSettings(patch: Partial<WindowSettings>): AppConfig {
    this.config.window = {
      ...this.config.window,
      ...patch,
      opacity: clampOpacity(patch.opacity ?? this.config.window.opacity),
      bounds: {
        ...this.config.window.bounds,
        ...(patch.bounds ?? {}),
      },
    };
    this.save();
    return this.getConfig();
  }
}
