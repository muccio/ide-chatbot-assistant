# Design Document: IDE Chatbot Assistant (macOS & Windows)

**Date:** 2026-11-17  
**Status:** Approved (Autonomous Execution - Approach 1)  
**Target Platforms:** macOS (`.app` / `.dmg`) and Windows (`.exe` NSIS / Portable)

---

## 1. Overview & Goals

A standalone desktop application for **macOS** and **Windows** that embeds any web-based LLM chatbot inside a floating, opacity-adjustable, always-on-top browser window, augmented with a dedicated IDE code-assistant bridge:

- **Universal Chatbot Browser**: Select from built-in presets (Gemini, ChatGPT, Claude, DeepSeek, Qwen, Perplexity, Grok, Mistral Le Chat, Local/OpenWebUI) or enter any custom URL, plus custom saved bookmarks.
- **Persistent Login & Multi-Profile Sessions**: Uses Electron `WebContentsView` with persistent session partitions (`persist:<profile>`), OAuth popup support (Google/GitHub/Microsoft SSO), and clean Chromium User-Agent handling.
- **Operating Parameters ("Parametri Operativi")**: Configurable prompt/system-instruction presets (role, target language, output style, prefix/suffix, custom rules), quick coding actions (Send, Fix Bug, Refactor, Explain, Write Tests), and browser/session behavior toggles (auto-submit, auto-copy generated code, clipboard polling, page zoom, User-Agent).
- **IDE Clipboard Bridge**:
  - **IDE → App**: Watches the system clipboard, displays copied code immediately in a dedicated "Input dall'IDE" panel (with syntax/line stats and recent clipboard history), and lets the user compose/inject it into the chatbot input wrapped with active operating parameters.
  - **Chatbot → IDE**: Extracts generated code blocks from the chatbot page into an "Output per l'IDE" list (with 1-click copy back to clipboard and optional auto-copy), while avoiding feedback loops on the input preview.
- **Floating Window Controls**: Always-on-Top toggle, adjustable transparency slider (`25%`–`100%`), optional "Full opacity on focus/hover", collapsible side panel, and persistent window bounds.

---

## 2. Architecture

### 2.1 Process & View Topology

```text
+-----------------------------------------------------------------------+
| BrowserWindow (Main Shell - renderer/index.html)                      |
| +-------------------------------------------------------------------+ |
| | Top Bar (52px): Back/Fwd/Reload | Presets | URL Input | AoT | α%  | |
| +----------------------+--------------------------------------------+ |
| | Side Panel (360px,   | WebContentsView (Chatbot Viewport)         | |
| | collapsible)         | - Partition: persist:<profileName>         | |
| |  [Clipboard & Code]  | - Loads any https:// or http://localhost   | |
| |  [Parametri Oper.]   | - OAuth popups in child BrowserWindow      | |
| |  [Output Estratto]   | - DOM bridge for input focus & code blocks | |
| +----------------------+--------------------------------------------+ |
| | Status Bar (26px): Active URL | Profile | Clipboard Status        | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

- **Main Process (`src/main/`)**:
  - `main.ts`: App lifecycle, `BrowserWindow` + child `WebContentsView` layout management, window opacity & always-on-top state, global/window shortcuts, OAuth popup handler.
  - `store.ts`: JSON persistence in `app.getPath('userData')/config.json` (window bounds, opacity, alwaysOnTop, panel open state, custom URLs, active profile, operating parameter presets, settings).
  - `clipboardWatcher.ts`: Polls `clipboard.readText()` at configurable intervals, filters duplicates & self-initiated output writes, maintains recent history.
  - `chatbotBridge.ts`: Handles DOM inspection/injection inside `chatbotView.webContents` (focusing editors, inserting composed prompts using native Electron `insertText` / `paste` + DOM fallback, optional submit, and polling/extracting rendered code blocks).
  - `ipc.ts`: Typed IPC handlers connecting Renderer UI and Main Process.
- **Preload (`src/preload/`)**:
  - `shellPreload.ts`: Exposes a strictly typed `window.assistantAPI` bridge via `contextBridge` to the shell renderer (`contextIsolation: true`, `nodeIntegration: false`).
- **Renderer (`src/renderer/`)**:
  - Clean, lightweight, zero-framework-bloat TypeScript/HTML/CSS UI (dark IDE-inspired theme with high contrast even at reduced window opacity).
- **Shared (`src/shared/`)**:
  - Pure TypeScript modules (`types.ts`, `defaults.ts`, `urlUtils.ts`, `promptBuilder.ts`, `clipboardLogic.ts`, `layoutMath.ts`, `codeExtractor.ts`) fully covered by unit tests.

---

## 3. Data Flow

1. **IDE → App**: User copies code in VS Code / Xcode / IntelliJ / etc. → `ClipboardWatcher` detects new clipboard text → emits `clipboard:changed` to Renderer → Input panel updates with code preview, line count, and timestamp.
2. **App → Chatbot**: User selects an operating parameter preset (or clicks an action like "Refactor" / "Fix Bug" / "Invia in Chat") → `promptBuilder` combines `[Role + Rules + Language + Output Mode + Prefix + Action + Code + Suffix]` → `chatbotBridge.injectPrompt()` focuses the active chat editor inside `WebContentsView` and inserts the text (with optional Enter submit if `autoSubmit` is enabled).
3. **Chatbot → IDE**: `chatbotBridge` periodically scans code blocks (`pre code`, custom code-block containers) inside the chatbot DOM → emits `chatbot:code-blocks` to Renderer → User clicks "Copia per IDE" (or `autoCopyLatestCode` triggers when generation finishes) → `clipboardWatcher.writeFromOutput(code)` writes to OS clipboard without overwriting the "Input dall'IDE" preview → User pastes directly into their IDE.

---

## 4. Packaging & Cross-Platform Strategy

- `electron-builder` configuration in `package.json`:
  - **macOS**: `dmg` + `zip` + `.app` (`arm64`, `x64`, `category: public.app-category.developer-tools`).
  - **Windows**: `nsis` installer + `portable` `.exe` (`x64`).
- **Build Icons**: Generated `build/icon.png` (512x512) and `build/icon.ico` / `build/icon.icns` (or PNG auto-converted by `electron-builder` on macOS/Windows).
- **CI Workflow**: `.github/workflows/build.yml` to build both `macos-latest` and `windows-latest` artifacts cleanly.
