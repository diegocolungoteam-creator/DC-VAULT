import type {Word} from '../types';

export type Block = {words: Word[]; start: number; end: number};

const TARGET = 4;
const CAP = 6;
const ends = (w: Word) => /[.,!?;:…]$/.test(w.text.trim());
const short = (b: Block) => b.words.length < 2 || b.end - b.start < 0.45;

/**
 * Word-level transcript → caption blocks (guide §9).
 * - ~4 words per block, break on punctuation
 * - merge short blocks RIGHT TO LEFT (left-to-right is greedy and strands a
 *   single word flashing for 0.26 s)
 * - clamp each block's end to the next block's start
 * tools/chunk_preview.py mirrors this — keep them in sync.
 */
export const chunk = (words: Word[]): Block[] => {
  const blocks: Block[] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (ends(w) || cur.length >= TARGET) {
      blocks.push(mk(cur));
      cur = [];
    }
  }
  if (cur.length) blocks.push(mk(cur));

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (!short(b) || blocks.length < 2) continue;
    const prev = blocks[i - 1];
    const next = blocks[i + 1];
    // A block that ends a sentence prefers the previous block; otherwise the next.
    if (prev && !ends(prev.words[prev.words.length - 1]) && prev.words.length + b.words.length <= CAP) {
      blocks.splice(i - 1, 2, mk([...prev.words, ...b.words]));
    } else if (next && next.words.length + b.words.length <= CAP) {
      blocks.splice(i, 2, mk([...b.words, ...next.words]));
    } else if (prev && prev.words.length + b.words.length <= CAP) {
      blocks.splice(i - 1, 2, mk([...prev.words, ...b.words]));
    }
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].end = Math.min(blocks[i].end, blocks[i + 1].start);
  }
  return blocks;
};

const mk = (ws: Word[]): Block => ({words: ws, start: ws[0].start, end: ws[ws.length - 1].end});

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ%]/g, '');
