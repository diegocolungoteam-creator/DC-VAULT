/**
 * Instagram UI boxes, measured from a published post and scaled onto the
 * 1080x1920 canvas (guide §8.9). Re-measure if Instagram changes its UI.
 */
export type Box = {x: number; y: number; w: number; h: number; label: string};

export const IG_UI: Box[] = [
  {x: 0, y: 0, w: 1080, h: 190, label: 'Reels: cabecera'},
  {x: 0, y: 78, w: 700, h: 60, label: 'avatar + usuario'},
  {x: 0, y: 124, w: 720, h: 44, label: 'fila de audio'},
  {x: 975, y: 90, w: 105, h: 48, label: 'menú ⋯'},
  {x: 0, y: 1440, w: 900, h: 480, label: 'Reels: usuario + texto + audio'},
  {x: 880, y: 980, w: 200, h: 940, label: 'Reels: botones'},
];

/** The fixed grid: readable content lives inside this box (420 px grid + measured UI). */
export const SAFE = {top: 432, bottom: 1430, left: 60, right: 1020} as const;

/** Below this y, stay left of RAIL_X (the button rail). */
export const RAIL_Y = 980;
export const RAIL_X = 880;

/** Captions are centred in this band so they never run under the rail. */
export const CAPTION_X = {left: 84, right: 884} as const;
