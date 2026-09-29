import React from 'react';
import {AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand} from '../brand';
import {Fonts} from '../fonts';
import type {Card} from '../types';
import {renderCard} from './cards';
import {Footage} from './Footage';

const SAMPLES: Card[] = [
  {type: 'hook', text: 'El error que te frena', highlight: 'error', start: 0, end: 2},
  {type: 'strike', wrong: 'Más cardio', right: 'Más fuerza', start: 2, end: 4},
  {type: 'number', label: 'Uno', items: ['Duerme 7 h', 'Proteína en cada comida', '3 días de fuerza'], at: [4.2, 4.8, 5.4], start: 4, end: 6},
  {type: 'quote', text: 'La constancia gana a la motivación.', author: 'PRIME-X Academy', start: 6, end: 8},
  {type: 'cta', keyword: 'PLAN', sub: 'y te mando la guía', start: 8, end: 10},
];

/** Logo lockup on the brand surface — for an outro or a brand still. */
export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: f, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{backgroundColor: brand.surface, alignItems: 'center', justifyContent: 'center'}}>
      <Img src={staticFile(brand.logoVertical)} style={{width: 640, opacity: s, transform: `scale(${0.94 + 0.06 * s})`}} />
    </AbsoluteFill>
  );
};

/** `brand` composition: every card, 2 s each, then the logo lockup — sign a look off in seconds. */
export const BrandSheet: React.FC = () => (
  <Fonts>
    <AbsoluteFill style={{backgroundColor: brand.black}}>
      <Footage src={null} camera={[]} handheld={0} volume={0} />
      {SAMPLES.map((c, i) => (
        <Sequence key={i} from={c.start * 30} durationInFrames={60} layout="none">
          {renderCard(c, {accent: brand.accent, accentText: brand.accentText, dur: 60})}
        </Sequence>
      ))}
      <Sequence from={10 * 30} durationInFrames={60} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  </Fonts>
);
