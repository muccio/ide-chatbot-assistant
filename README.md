# IDE Chatbot Assistant

Applicazione desktop standalone per **macOS** e **Windows** che integra qualsiasi chatbot LLM web (Gemini, ChatGPT, Claude, DeepSeek, Qwen, Perplexity, Grok, Mistral, Ollama/OpenWebUI o qualsiasi URL personalizzato) in una finestra flottante **Always-on-Top** con **trasparenza regolabile** e ponte bidirezionale con la **clipboard del tuo IDE**.

## Funzionalità principali

- **Browser Chatbot Universale**: Seleziona uno dei 24+ provider preconfigurati (Google Gemini, Google AI Studio, ChatGPT, Claude, DeepSeek, Qwen, Microsoft Copilot, GitHub Copilot, Perplexity, Grok, Mistral Le Chat, Meta AI, Kimi, GLM/Z.ai, Poe, Duck.ai, HuggingChat, LMArena, Phind, Blackbox AI, v0, Bolt.new, OpenWebUI, AnythingLLM) o inserisci manualmente qualsiasi URL (`https://...` oppure `localhost:3000`). Salva i tuoi chatbot preferiti.
- **Login Persistente & Multi-Profilo**: Sessioni isolate e persistenti (`default`, `work`, `personal`) con supporto ai popup OAuth/SSO (Google, GitHub, Microsoft) e User-Agent Chrome configurabile.
- **Parametri Operativi**:
  - Preset di istruzioni salvabili (Ruolo/System Prompt, Linguaggio/Stack target, Formato risposta, Regole operative, Prefisso e Suffisso).
  - Azioni rapide 1-click (`Invia in Chat`, `Fix Bug`, `Refactor`, `Unit Test`, `Spiega`).
  - Controlli comportamento (`Auto-invia`, `Auto-copia codice generato`, `Zoom`, `Monitoraggio clipboard`, `Opacità 100% al focus`).
- **Ponte Clipboard IDE ↔ Chatbot**:
  - Copia del codice in qualsiasi IDE (VS Code, Xcode, IntelliJ, Cursor, Neovim, ecc.): appare subito nel pannello **Clipboard IDE** con cronologia delle copie recenti.
  - I blocchi di codice generati dal chatbot vengono estratti nel pannello **Output** e copiabili in clipboard con 1 click (o automaticamente) senza sovrascrivere l'input dell'IDE.
- **Always-on-Top & Trasparenza**: Pulsante rapido `Pin Top` e slider opacità `25%–100%` sempre visibili nella barra superiore.

## Scorciatoie da tastiera

- `Cmd/Ctrl + Shift + T`: Attiva/Disattiva Always on Top
- `Cmd/Ctrl + Shift + B`: Mostra/Nascondi pannello laterale
- `Cmd/Ctrl + Shift + I`: Inietta codice clipboard + parametri operativi nella chat
- `Cmd/Ctrl + Shift + K`: Copia l'ultimo blocco di codice generato dal chatbot in clipboard
- `Cmd/Ctrl + R`: Ricarica la pagina del chatbot

## Sviluppo & Test

```bash
npm install
npm test
npm start
```

## Creazione pacchetti standalone (macOS & Windows)

- **macOS** (`.app`, `.dmg`, `.zip` arm64/x64):
  ```bash
  npm run package:mac
  ```
- **Windows** (`.exe` installer NSIS e portable x64 — eseguibile su Windows o tramite `.github/workflows/build.yml`):
  ```bash
  npm run package:win
  ```
