| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Explore & Design (`docs/plans/2026-11-17-chatbot-assistant-design.md`) | Done | Approach 1 (Electron + TS + WebContentsView) |
| 2 | Task 1: Project Scaffolding & Dependencies | Done | `package.json`, `tsconfig`, `vitest.config.ts`, `npm install` |
| 3 | Task 2: Shared Domain Logic & TDD Unit Tests | Done | 12/12 tests passing in `tests/shared.test.ts` |
| 4 | Task 3: Main Process (Store, ClipboardWatcher, Bridge, IPC, Window) | Done | `store.ts`, `clipboardWatcher.ts`, `chatbotBridge.ts`, `chatbotHost.ts`, `ipc.ts`, `main.ts` |
| 5 | Task 4: Shell Renderer UI (Toolbar, Side Panel, Status Bar) | Done | `index.html`, `styles.css`, `renderer.ts` |
| 6 | Task 5: Preload/Clipboard/AoT/Opacity Fix & 24 Chatbots | Done | Fixed ESM preload overwrite, fullscreen AoT, E2E Electron verified (`E2E_ALL_PASSED`) |
| 7 | Task 6: macOS Build, Git Repo, Push & Release | Done | Repo `muccio/ide-chatbot-assistant`, pushed `main` & `v1.0.0` release |
