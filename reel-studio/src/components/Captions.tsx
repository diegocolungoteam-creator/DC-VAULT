import React, {useMemo} from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand} from '../brand';
import {CAPTION_X} from '../ig-safe';
import {chunk, norm} from '../lib/chunk';
import type {Word} from '../types';

/**
 * Word-by-word captions from the first word to the last. NEVER muted — not
 * under a card, not under the CTA (guide §9). Collisions are solved by
 * placement (captionY), not by hiding captions.
 */
export const Captions: React.FC<{
  words: Word[];
  emphasis: string[];
  y: number;
  accentText: string;
}> = ({words, emphasis, y, accentText}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const blocks = useMemo(() => chunk(words), [words]);
  const hot = useMemo(() => new Set(emphasis.map(norm)), [emphasis]);

  const block = blocks.find((b, i) => t >= b.start && t < (blocks[i + 1]?.start ?? b.end + 0.4));
  if (!block) return null;

  const pop = interpolate(t - block.start, [0, 0.12], [0.92, 1], {extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'absolute',
        left: CAPTION_X.left,
        width: CAPTION_X.right - CAPTION_X.left,
        top: y,
        transform: `translateY(-50%) scale(${pop})`,
        textAlign: 'center',
        fontFamily: brand.font,
        fontWeight: 900,
        fontSize: 66,
        lineHeight: 1.12,
        letterSpacing: -0.5,
        textTransform: 'uppercase',
        textShadow: '0 4px 18px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.6)',
      }}
    >
      {block.words.map((w, i) => {
        const spoken = t >= w.start - 0.03;
        const isHot = hot.has(norm(w.text));
        return (
          <span
            key={i}
            style={{
              color: isHot ? accentText : brand.white,
              opacity: spoken ? 1 : 0.55,
            }}
          >
            {w.text.trim()}
            {i < block.words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};
