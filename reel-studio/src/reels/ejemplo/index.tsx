import type {Card, ReelProps} from '../../types';
import words from '../../../public/ejemplo/tx/words.json';
import cards from './cards.json';

/**
 * Demo reel with a placeholder speaker. Copy this folder for a real reel:
 *   tools/new-reel.sh reel-01
 * cards.json is kept as JSON so tools/audit_cards.py can read it.
 */
const reel: ReelProps = {
  video: null, // 'ejemplo/video.mp4' once assemble.py has built the master
  durationSec: 20.4,
  words,
  cards: cards as Card[],
  camera: [
    {start: 3.6, end: 5.9, scale: 1.07, originY: 36, reason: 'afirmación clave: "el problema no es el esfuerzo"'},
    {start: 16.7, end: 20.4, scale: 1.05, originY: 34, reason: 'CTA: se inclina hacia la cámara'},
  ],
  sfx: [
    // Whoosh on the CUT, not on the card (guide §10). Put normalised files in public/sfx/.
    // {src: 'sfx/whoosh-air.mp3', at: 6.1, volume: 0.35, note: 'corte al bloque 2'},
  ],
  safe: {headTop: 0.3, chinBottom: 0.62},
  emphasis: ['fuerza', 'plan', 'proteína'],
  captionY: 1320,
  handheld: 4,
  grain: 0, // 0.22 once public/fx/grain.mp4 exists
  music: null, // {src: 'music/bed.mp3', volume: 0.08}
  voiceVolume: 0.94,
};

export default reel;
