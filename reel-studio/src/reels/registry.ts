import type {ReelProps} from '../types';
import ejemplo from './ejemplo';

/**
 * Every reel, by id. Each one registers three compositions in Root.tsx:
 *   <id>          with music
 *   <id>-nomusic  clean, for trending audio added in-app (guide §11)
 *   <id>-ig       with the Instagram safe-zone overlay (guide §8.9)
 * tools/new-reel.sh adds the import + entry for you.
 */
export const REELS: Record<string, ReelProps> = {
  ejemplo,
};
