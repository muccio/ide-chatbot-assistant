import { ExtractedCodeBlock } from './types';

export interface RawExtractedBlock {
  language: string;
  code: string;
}

const UI_HEADER_NOISE = /^(copy code|copia codice|copy|copia|bash|shell|typescript|javascript|python|json|html|css|sql|rust|go|java|cpp|c\+\+|csharp|c#)\s*\n/i;

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Cleans and deduplicates raw code blocks extracted from chatbot web pages.
 */
export function sanitizeCodeBlocks(rawBlocks: RawExtractedBlock[]): ExtractedCodeBlock[] {
  const seen = new Set<string>();
  const cleaned: ExtractedCodeBlock[] = [];

  for (const raw of rawBlocks) {
    let code = (raw.code ?? '').replace(/\r\n/g, '\n');
    code = code.replace(UI_HEADER_NOISE, '').trim();
    if (!code) {
      continue;
    }

    const hash = simpleHash(code);
    if (seen.has(hash)) {
      continue;
    }
    seen.add(hash);

    cleaned.push({
      id: `code-${hash}`,
      language: (raw.language || 'text').trim().toLowerCase(),
      code,
      lineCount: code.split('\n').length,
      hash,
    });
  }

  return cleaned;
}
