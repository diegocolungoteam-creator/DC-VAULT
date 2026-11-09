export type Word = {text: string; start: number; end: number};

/** Where a card sits. All slots are inside the safe box from ig-safe.ts. */
export type Slot = 'top' | 'lower' | 'center' | 'side';

type Timed = {id?: string; start: number; end: number; slot?: Slot};

export type Card =
  | (Timed & {type: 'hook'; text: string; highlight?: string})
  | (Timed & {type: 'quote'; text: string; author?: string})
  | (Timed & {type: 'strike'; wrong: string; right?: string})
  /** One point at a time, so the list never grows over the face. `at` = when each item is said (s). */
  | (Timed & {type: 'number'; label: string; items: string[]; at?: number[]})
  | (Timed & {type: 'cta'; keyword: string; lead?: string; sub?: string});

/** A motivated camera move (guide §12). Scale never goes below 1. */
export type CameraMove = {
  start: number;
  end: number;
  scale: number;
  /** transform-origin in % of the frame; keep y at 34–46 so pushes lift towards the eyes. */
  originX?: number;
  originY?: number;
  /** seconds to ease into the move; default 0.35 */
  ease?: number;
  /** why this move exists — required on purpose, a zoom without a reason is a template zoom */
  reason: string;
};

export type SfxCue = {src: string; at: number; volume: number; note?: string};

export type ReelProps = {
  /** assembled master in public/, e.g. 'reel-01/video.mp4'; null = placeholder background */
  video: string | null;
  durationSec: number;
  words: Word[];
  cards: Card[];
  camera: CameraMove[];
  sfx: SfxCue[];
  /** Measured speaker band as fractions of frame height (guide §8.9). Drawn on the -ig still. */
  safe: {headTop: number; chinBottom: number};
  accent?: string;
  accentText?: string;
  /** words the captions colour (lower-case, no punctuation) */
  emphasis: string[];
  /** y of the caption block's centre */
  captionY: number;
  /** px of noise-driven drift on the footage; 0 to disable */
  handheld: number;
  /** film-grain opacity (needs public/fx/grain.mp4); 0 to switch off */
  grain: number;
  music: {src: string; volume: number} | null;
  /** footage volume; ~0.94 leaves headroom for SFX (guide §10) */
  voiceVolume: number;
  /** render the Instagram safe-zone overlay on top */
  igOverlay?: boolean;
};
