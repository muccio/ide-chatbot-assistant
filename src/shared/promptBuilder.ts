import { OutputMode, PromptBuildInput, QuickActionType } from './types';

const OUTPUT_MODE_INSTRUCTIONS: Record<OutputMode, string> = {
  'code-only': 'Rispondi SOLO con il codice finale dentro un blocco markdown, senza spiegazioni discorsive.',
  'code-and-brief': 'Fornisci il codice completo in un blocco markdown seguito da una spiegazione sintetica per punti.',
  'diff-only': 'Evidenzia le modifiche necessarie e mostra il codice aggiornato pronto per essere copiato.',
  detailed: 'Fornisci analisi dettagliata, alternative possibili e codice completo commentato.',
};

const ACTION_PROMPTS: Record<QuickActionType, string> = {
  send: 'Analizza ed esegui la richiesta seguente sul codice fornito.',
  fix: 'Individua eventuali bug, edge case o errori di tipo e correggi il codice mantenendone la semantica.',
  refactor: 'Esegui un Refactoring del codice migliorando leggibilità, modularità, tipizzazione e performance.',
  tests: 'Scrivi unit test completi e significativi (casi normali e casi limite) per questo codice.',
  explain: 'Spiega chiaramente cosa fa questo codice, complessità, dipendenze e possibili criticità.',
};

function resolveFenceLanguage(targetLanguage: string): string {
  const cleaned = targetLanguage.trim().toLowerCase();
  if (!cleaned || cleaned === 'auto-detect') {
    return '';
  }
  return cleaned.replace(/[^a-z0-9_+-]/g, '');
}

/**
 * Builds a structured coding prompt combining active operating parameters, action intent, and copied code.
 */
export function buildCodingPrompt(input: PromptBuildInput): string {
  const { preset, code, action, userInstruction } = input;
  const sections: string[] = [];

  if (preset.prefix.trim()) {
    sections.push(preset.prefix.trim());
  }

  const directives: string[] = [];
  if (preset.role.trim()) {
    directives.push(`Ruolo: ${preset.role.trim()}`);
  }
  if (preset.targetLanguage.trim() && preset.targetLanguage !== 'Auto-detect') {
    directives.push(`Linguaggio/Stack target: ${preset.targetLanguage.trim()}`);
  }
  directives.push(`Formato risposta: ${OUTPUT_MODE_INSTRUCTIONS[preset.outputMode]}`);
  if (preset.customRules.trim()) {
    directives.push(`Regole operative: ${preset.customRules.trim()}`);
  }

  if (directives.length > 0) {
    sections.push(`[Parametri Operativi]\n${directives.join('\n')}`);
  }

  sections.push(`[Compito]\n${ACTION_PROMPTS[action]}`);

  if (userInstruction && userInstruction.trim()) {
    sections.push(`[Istruzione Utente]\n${userInstruction.trim()}`);
  }

  const trimmedCode = code.trim();
  if (trimmedCode.length > 0) {
    const lang = resolveFenceLanguage(preset.targetLanguage);
    sections.push(`[Codice dall'IDE]\n\`\`\`${lang}\n${code.replace(/\r\n/g, '\n').trimEnd()}\n\`\`\``);
  }

  if (preset.suffix.trim()) {
    sections.push(preset.suffix.trim());
  }

  return sections.join('\n\n');
}
