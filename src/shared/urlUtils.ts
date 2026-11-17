const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Normalizes a user-supplied chatbot URL into a safe http/https URL.
 * Bare hostnames default to https://, except localhost and loopback IPs which default to http://.
 */
export function normalizeChatbotUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;
  const hasExplicitUrlScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate);
  const hasNonWebScheme = /^(javascript|data|vbscript|file|mailto|tel|about):/i.test(candidate);

  if (hasNonWebScheme) {
    return null;
  }

  if (!hasExplicitUrlScheme) {
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(\/|$)/i.test(candidate);
    candidate = `${isLocalHost ? 'http' : 'https'}://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Checks whether a navigation target URL is safe to load in the embedded chatbot WebContentsView.
 */
export function isAllowedNavigationUrl(rawUrl: string): boolean {
  if (rawUrl === 'about:blank') {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
