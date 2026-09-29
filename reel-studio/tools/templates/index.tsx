import type {Card, ReelProps} from '../../types';
import words from '../../../public/__REEL__/tx/words.json';
import cards from './cards.json';

/** Reel __REEL__. Cards live in cards.json so tools/audit_cards.py can read them. */
const reel: ReelProps = {
  video: '__REEL__/video.mp4',
  durationSec: 30, // set to the master's length (tools/qc.sh prints it)
  words,
  cards: cards as Card[],
  camera: [
    // {start: 3.6, end: 5.9, scale: 1.07, originY: 36, reason: 'afirmación clave'},
  ],
  sfx: [
    // {src: 'sfx/whoosh-air.mp3', at: 6.1, volume: 0.35, note: 'corte al bloque 2'},
  ],
  safe: {headTop: 0.3, chinBottom: 0.62}, // MEASURE per shoot (guide §8.9)
  emphasis: [],
  captionY: 1320,
  handheld: 4,
  grain: 0,
  music: null,
  voiceVolume: 0.94,
};

export default reel;
