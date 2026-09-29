export const FPS = 30;
export const W = 1080;
export const H = 1920;

/**
 * House brand tokens. Every reel reads from here — change a colour once and
 * every reel re-renders correctly.
 *
 * TODO(marca): these are placeholders. Replace with your real colours,
 * sampled from the footage if you can (guide §6).
 */
export const brand = {
  black: '#0B0B0C',
  white: '#FFFFFF',
  /** SOLID FILLS ONLY — slabs, chips, bars. `onAccent` text sits on top. */
  accent: '#2B2EFF',
  /** Text colour on top of `accent`. Use black if the accent is light (<3:1 with white). */
  onAccent: '#FFFFFF',
  /** Coloured TEXT laid over video. Must be lighter than `accent` (>=3:1 on bright frames). */
  accentText: '#8F91FF',
  /** Dark background for full-frame screenshots and the no-footage placeholder. */
  surface: '#15161A',
  font: 'Inter, -apple-system, sans-serif',
  /** Logo in public/brand/. Set to null to hide it. */
  logo: null as string | null,
} as const;

export const sec = (s: number) => Math.round(s * FPS);
