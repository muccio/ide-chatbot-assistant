import { AppConfig, ChatbotProvider, OperatingPreset } from './types';

export const DEFAULT_PROVIDERS: ChatbotProvider[] = [
  { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com/app', builtIn: true },
  { id: 'aistudio', name: 'Google AI Studio', url: 'https://aistudio.google.com/', builtIn: true },
  { id: 'chatgpt', name: 'ChatGPT (OpenAI)', url: 'https://chatgpt.com/', builtIn: true },
  { id: 'claude', name: 'Claude (Anthropic)', url: 'https://claude.ai/', builtIn: true },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/', builtIn: true },
  { id: 'qwen', name: 'Qwen Chat', url: 'https://chat.qwen.ai/', builtIn: true },
  { id: 'copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com/', builtIn: true },
  { id: 'github-copilot', name: 'GitHub Copilot', url: 'https://github.com/copilot', builtIn: true },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/', builtIn: true },
  { id: 'grok', name: 'Grok (xAI)', url: 'https://grok.com/', builtIn: true },
  { id: 'mistral', name: 'Mistral Le Chat', url: 'https://chat.mistral.ai/', builtIn: true },
  { id: 'meta-ai', name: 'Meta AI', url: 'https://www.meta.ai/', builtIn: true },
  { id: 'kimi', name: 'Kimi (Moonshot)', url: 'https://kimi.ai/', builtIn: true },
  { id: 'glm', name: 'GLM / Z.ai Chat', url: 'https://chat.z.ai/', builtIn: true },
  { id: 'poe', name: 'Poe (Multi-LLM)', url: 'https://poe.com/', builtIn: true },
  { id: 'duck-ai', name: 'Duck.ai (Free)', url: 'https://duck.ai/', builtIn: true },
  { id: 'huggingchat', name: 'HuggingChat (OSS)', url: 'https://huggingface.co/chat/', builtIn: true },
  { id: 'lmarena', name: 'LMArena (Free)', url: 'https://lmarena.ai/', builtIn: true },
  { id: 'phind', name: 'Phind (Dev)', url: 'https://www.phind.com/', builtIn: true },
  { id: 'blackbox', name: 'Blackbox AI', url: 'https://www.blackbox.ai/', builtIn: true },
  { id: 'v0', name: 'v0 by Vercel', url: 'https://v0.dev/', builtIn: true },
  { id: 'bolt', name: 'Bolt.new', url: 'https://bolt.new/', builtIn: true },
  { id: 'openwebui', name: 'Local OpenWebUI', url: 'http://localhost:3000/', builtIn: true },
  { id: 'anythingllm', name: 'Local AnythingLLM', url: 'http://localhost:3001/', builtIn: true },
];

export const DEFAULT_PRESETS: OperatingPreset[] = [
  {
    id: 'senior-coder',
    name: 'Senior Code Assistant',
    role: 'Agisci come un Senior Software Engineer esperto di architettura pulita, tipizzazione strict e best practice.',
    targetLanguage: 'Auto-detect',
    outputMode: 'code-and-brief',
    customRules: 'Evita placeholder o omissioni (...). Mantieni compatibilità e gestisci i casi limite.',
    prefix: '',
    suffix: '',
  },
  {
    id: 'code-only',
    name: 'Solo Codice (Pronto per Incolla)',
    role: 'Agisci come generatore di codice di produzione.',
    targetLanguage: 'Auto-detect',
    outputMode: 'code-only',
    customRules: 'Restituisci esclusivamente codice completo e funzionante in un unico blocco markdown.',
    prefix: '',
    suffix: '',
  },
  {
    id: 'bug-hunter',
    name: 'Debug & Fix Mirato',
    role: 'Agisci come specialista di debugging e root-cause analysis.',
    targetLanguage: 'Auto-detect',
    outputMode: 'diff-only',
    customRules: 'Identifica prima la causa esatta del bug, poi fornisci il codice corretto pronto per la sostituzione.',
    prefix: '',
    suffix: '',
  },
];

export const DEFAULT_CONFIG: AppConfig = {
  activeProviderId: 'gemini',
  activeUrl: DEFAULT_PROVIDERS[0].url,
  providers: DEFAULT_PROVIDERS,
  activePresetId: DEFAULT_PRESETS[0].id,
  presets: DEFAULT_PRESETS,
  session: {
    profileId: 'default',
    autoSubmit: false,
    autoCopyGeneratedCode: false,
    clipboardPollingEnabled: true,
    clipboardPollIntervalMs: 350,
    zoomFactor: 1.0,
    userAgentMode: 'auto',
    customUserAgent: '',
  },
  window: {
    alwaysOnTop: true,
    opacity: 0.96,
    fullOpacityOnFocus: false,
    sidebarOpen: true,
    sidebarWidth: 360,
    bounds: {
      width: 1280,
      height: 840,
    },
  },
};

export const CHROME_USER_AGENTS = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.191 Safari/537.36',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.191 Safari/537.36',
};

export const FIREFOX_USER_AGENTS = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};
