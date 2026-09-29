export const FPS = 30;
export const W = 1080;
export const H = 1920;

/**
 * PRIME-X (High-Performance / Academy) brand tokens. Every reel reads from
 * here — change a colour once and every reel re-renders correctly.
 *
 * Colours sampled from the logo files (public/brand/source-*.jpg), not a mood board.
 * Contrast checked, not guessed (guide §6):
 *   white on `accent`            6.0 : 1
 *   `accentText` vs white frame  3.4 : 1   (and 6.3 : 1 on black)
 */
export const brand = {
  name: 'PRIME-X',
  black: '#0C0819',
  white: '#FFFFFF',
  /** SOLID FILLS ONLY — slabs, chips, bars. `onAccent` text sits on top. Logo mid-tone purple. */
  accent: '#8B2FD6',
  /** Text colour on top of `accent`. */
  onAccent: '#FFFFFF',
  /** Coloured TEXT laid over video. Lighter tint of the accent so it reads on bright frames. */
  accentText: '#B06CF0',
  /** Dark background for full-frame screenshots and the no-footage placeholder — the logo's backdrop. */
  surface: '#0C0819',
  /** Geometric sans close to the PRIME-X wordmark. Montserrat is OFL — safe for commercial reels. */
  font: 'Montserrat, Inter, -apple-system, sans-serif',
  /** Hexagon + DNA mark, transparent PNG. Shown top-right when no top card is on screen. */
  logo: 'brand/logo-mark.png' as string | null,
  /** Full lockups for end cards / brand stills. */
  logoHorizontal: 'brand/logo-horizontal.png',
  logoVertical: 'brand/logo-vertical.png',
} as const;

export const sec = (s: number) => Math.round(s * FPS);
