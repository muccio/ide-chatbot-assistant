import { Rect, WebViewBoundsInput } from './types';

export const MIN_OPACITY = 0.25;
export const MAX_OPACITY = 1.0;

/**
 * Clamps window opacity into [0.25, 1.0] so the floating assistant remains visible and draggable.
 */
export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return MAX_OPACITY;
  }
  return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, Math.round(value * 100) / 100));
}

/**
 * Computes the exact viewport bounds for the embedded chatbot WebContentsView inside the shell window.
 */
export function calculateWebViewBounds(input: WebViewBoundsInput): Rect {
  const sidebarOffset = input.sidebarOpen ? Math.max(0, Math.min(input.sidebarWidth, Math.floor(input.contentWidth * 0.6))) : 0;
  const width = Math.max(200, input.contentWidth - sidebarOffset);
  const height = Math.max(150, input.contentHeight - input.topBarHeight - input.statusBarHeight);

  return {
    x: sidebarOffset,
    y: input.topBarHeight,
    width,
    height,
  };
}
