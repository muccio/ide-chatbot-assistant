import { WebContents } from 'electron';
import { RawExtractedBlock, sanitizeCodeBlocks } from '../shared/codeExtractor';
import { ExtractedCodeBlock } from '../shared/types';

export interface InjectPromptResult {
  ok: boolean;
  method: 'dom-exec' | 'native-setter' | 'electron-insert' | 'none';
  submitted: boolean;
  error?: string;
}

const FOCUS_AND_INSERT_SCRIPT = (promptText: string, autoSubmit: boolean): string => `
(async () => {
  const text = ${JSON.stringify(promptText)};
  const shouldSubmit = ${JSON.stringify(autoSubmit)};

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 20 && rect.height > 16 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function findEditor() {
    const prioritySelectors = [
      '#prompt-textarea',
      'rich-textarea div[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div.ProseMirror[contenteditable="true"]',
      'textarea[data-id]',
      'textarea[placeholder*="Message" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Send" i]',
      'textarea[placeholder*="Scrivi" i]',
      'textarea[placeholder*="Chiedi" i]',
      'textarea:not([disabled]):not([readonly])',
      '[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];

    for (const sel of prioritySelectors) {
      const candidates = Array.from(document.querySelectorAll(sel)).filter(isVisible);
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          return (rb.width * rb.height) - (ra.width * ra.height);
        });
        return candidates[0];
      }
    }
    return null;
  }

  const editor = findEditor();
  if (!editor) {
    return { ok: false, method: 'none', submitted: false, error: 'Nessun campo input chat trovato nella pagina.' };
  }

  editor.focus();

  let method = 'none';

  if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
    const proto = editor.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    const prev = editor.value || '';
    const nextVal = prev.trim().length > 0 ? prev + '\\n\\n' + text : text;

    if (descriptor && descriptor.set) {
      descriptor.set.call(editor, nextVal);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      method = 'native-setter';
    } else {
      const inserted = document.execCommand('insertText', false, text);
      method = inserted ? 'dom-exec' : 'none';
    }
  } else {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const prefix = (editor.innerText || '').trim().length > 0 ? '\\n\\n' : '';
    const inserted = document.execCommand('insertText', false, prefix + text);
    if (inserted) {
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prefix + text }));
      method = 'dom-exec';
    } else {
      const dt = new DataTransfer();
      dt.setData('text/plain', prefix + text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });
      editor.dispatchEvent(pasteEvent);
      if ((editor.innerText || '').trim().length === 0) {
        editor.textContent = prefix + text;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      method = 'dom-exec';
    }
  }

  let submitted = false;
  if (shouldSubmit) {
    await new Promise((r) => setTimeout(r, 150));
    const sendSelectors = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Invia" i]',
      'button[aria-label*="Submit" i]',
      'button.send-button',
      'button[type="submit"]'
    ];
    for (const sel of sendSelectors) {
      const btn = Array.from(document.querySelectorAll(sel)).find((b) => isVisible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
      if (btn) {
        btn.click();
        submitted = true;
        break;
      }
    }
    if (!submitted) {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      submitted = true;
    }
  }

  return { ok: method !== 'none', method, submitted };
})()
`;

const EXTRACT_CODE_BLOCKS_SCRIPT = `
(() => {
  const results = [];
  const preElements = Array.from(document.querySelectorAll('pre'));

  for (const pre of preElements) {
    const codeEl = pre.querySelector('code') || pre;
    const text = (codeEl.innerText || codeEl.textContent || '').trim();
    if (!text) continue;

    let language = 'text';
    const classList = [codeEl.className || '', pre.className || ''].join(' ');
    const langMatch = classList.match(/(?:language-|lang-)([a-zA-Z0-9_+-]+)/i);
    if (langMatch && langMatch[1]) {
      language = langMatch[1];
    } else {
      const header = pre.previousElementSibling || pre.parentElement?.querySelector('[class*="lang" i], [class*="header" i]');
      const headerText = header ? (header.textContent || '').trim().split(/\\s+/)[0] : '';
      if (headerText && headerText.length <= 16 && /^[a-z0-9_+#.-]+$/i.test(headerText)) {
        language = headerText;
      }
    }

    results.push({ language, code: text });
  }

  return results;
})()
`;

/**
 * Injects composed coding prompts into the active chatbot DOM and extracts generated code blocks.
 */
export async function injectPromptIntoChatbot(
  webContents: WebContents,
  promptText: string,
  autoSubmit: boolean,
): Promise<InjectPromptResult> {
  if (webContents.isDestroyed()) {
    return { ok: false, method: 'none', submitted: false, error: 'Chatbot view non disponibile.' };
  }

  try {
    const result = (await webContents.executeJavaScript(
      FOCUS_AND_INSERT_SCRIPT(promptText, autoSubmit),
      true,
    )) as InjectPromptResult;

    if (result && result.ok) {
      return result;
    }

    // Fallback: insert directly via Electron WebContents if DOM script could not mutate editor
    if (result?.method === 'none') {
      return result;
    }

    await webContents.insertText(promptText);
    return { ok: true, method: 'electron-insert', submitted: false };
  } catch (err) {
    return {
      ok: false,
      method: 'none',
      submitted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extracts and sanitizes code blocks rendered inside the chatbot web page.
 */
export async function extractCodeBlocksFromChatbot(
  webContents: WebContents,
): Promise<ExtractedCodeBlock[]> {
  if (webContents.isDestroyed()) {
    return [];
  }

  try {
    const raw = (await webContents.executeJavaScript(
      EXTRACT_CODE_BLOCKS_SCRIPT,
      true,
    )) as RawExtractedBlock[];
    if (!Array.isArray(raw)) {
      return [];
    }
    return sanitizeCodeBlocks(raw);
  } catch {
    return [];
  }
}
