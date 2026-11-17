# IDE Chatbot Assistant Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Build a standalone cross-platform desktop app (macOS & Windows) embedding any LLM chatbot in an Always-on-Top, opacity-adjustable browser window with an IDE clipboard bridge and configurable operating parameters.

**Architecture:** Electron `BrowserWindow` (toolbar + collapsible side panel + status bar) paired with a dynamically bounded child `WebContentsView` for isolated, persistent-session LLM web pages (supporting OAuth popups and DOM injection/extraction), backed by tested pure TypeScript domain modules and `electron-builder` packaging.

**Tech Stack:** Electron 33+, TypeScript, Vitest, HTML/CSS, `electron-builder`

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.renderer.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1:** Initialize `package.json` with Electron, TypeScript, Vitest, `electron-builder`, scripts (`dev`, `build`, `test`, `package:mac`, `package:win`), and `electron-builder` config for macOS (`dmg`, `zip`) and Windows (`nsis`, `portable`).  
**Step 2:** Create `tsconfig.json` (for main/preload/shared CommonJS output into `dist/`) and `tsconfig.renderer.json` (for browser renderer ES output into `dist/renderer/`), plus `vitest.config.ts`.  
**Step 3:** Run `npm install` and verify `npx tsc --version` and `npx vitest --version`.

---

### Task 2: Shared Domain Types, Defaults & Pure Logic (TDD)

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/defaults.ts`
- Create: `src/shared/urlUtils.ts`
- Create: `src/shared/promptBuilder.ts`
- Create: `src/shared/clipboardLogic.ts`
- Create: `src/shared/layoutMath.ts`
- Create: `src/shared/codeExtractor.ts`
- Test: `tests/shared.test.ts`

**Step 1:** Write failing unit tests in `tests/shared.test.ts` covering:
  - URL normalization (`chatgpt.com` -> `https://chatgpt.com`, `localhost:3000` -> `http://localhost:3000`, invalid rejection)
  - Prompt builder (combining operating parameters: role, targetLanguage, outputMode, customRules, prefix/suffix, action task, fenced code block)
  - Clipboard deduplication & self-write ignore (`ClipboardTracker`)
  - Opacity clamping `[0.25, 1.0]` & `WebContentsView` bounds calculation (`calculateWebViewBounds`)
  - Code block sanitization / deduplication (`sanitizeCodeBlocks`)
**Step 2:** Run `npx vitest run` to confirm tests fail before implementation.
**Step 3:** Implement all `src/shared/*` modules cleanly.
**Step 4:** Run `npx vitest run` and verify all tests pass.

---

### Task 3: Config Store, Clipboard Watcher & Chatbot DOM Bridge (Main Process)

**Files:**
- Create: `src/main/store.ts`
- Create: `src/main/clipboardWatcher.ts`
- Create: `src/main/chatbotBridge.ts`
- Create: `src/main/ipc.ts`
- Create: `src/main/main.ts`
- Create: `src/preload/shellPreload.ts`
- Test: `tests/store.test.ts`

**Step 1:** Write failing tests in `tests/store.test.ts` for config persistence, merging defaults, saving/deleting custom providers, and saving/updating operating parameter presets.
**Step 2:** Run `npx vitest run tests/store.test.ts` to verify failure.
**Step 3:** Implement `src/main/store.ts` and verify `tests/store.test.ts` passes.
**Step 4:** Implement `src/main/clipboardWatcher.ts`, `src/main/chatbotBridge.ts` (editor detection + Electron `insertText`/`paste` fallback + code block extraction script), `src/preload/shellPreload.ts`, `src/main/ipc.ts`, and `src/main/main.ts` (`BrowserWindow` + `WebContentsView`, OAuth popup handler, clean Chrome User-Agent, Always-on-Top, Opacity + focus-boost, global/local shortcuts).

---

### Task 4: Shell Renderer UI (Toolbar, Side Panel & Status Bar)

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/styles.css`
- Create: `src/renderer/renderer.ts`

**Step 1:** Build top navigation & window-control bar (back/forward/reload, provider dropdown + add custom bookmark, URL input, Always-on-Top toggle, Opacity slider + focus-boost toggle, Side Panel toggle).
**Step 2:** Build collapsible 3-tab side panel:
  - **Clipboard (IDE)**: Live IDE copied code preview, quick action buttons (`Invia`, `Fix`, `Refactor`, `Test`, `Spiega`), editable prompt override, clipboard history chips.
  - **Parametri Operativi**: Preset manager (create/edit/delete), role/system instructions, target language, output style, prefix/suffix, session profile selector, `Auto-invio`, `Auto-copia codice generato`, `Zoom`, `User-Agent`, `Cancella sessione/cookie`.
  - **Output Codice**: Extracted code blocks from the chatbot with language badge, line count, preview, and 1-click `Copia per IDE` button.
**Step 3:** Connect all UI controls to `window.assistantAPI` IPC events and state sync.

---

### Task 5: Icons, Cross-Platform Packaging Config & Verification

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `build/icon.png` (and `.icns`/`.ico` if needed)
- Create: `.github/workflows/build.yml`
- Create: `README.md`

**Step 1:** Generate crisp app icons in `build/` (`icon.png`, `icon.icns` via `iconutil` on macOS if available, and `icon.ico` via Node PNG-to-ICO packer so Windows packaging works out of the box!).
**Step 2:** Run full TypeScript compilation (`npm run build`), full Vitest suite (`npm test`), and Electron smoke launch verification.
**Step 3:** Run `npm run package:mac` to build the standalone macOS `.app` / `.dmg` in `release/` and verify the output artifact exists and is valid.
**Step 4:** Add `.github/workflows/build.yml` and `README.md` documenting macOS and Windows usage and builds.
