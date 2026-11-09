import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand, sec} from '../brand';
import {Fonts} from '../fonts';
import type {ReelProps} from '../types';
import {Captions} from './Captions';
import {renderCard} from './cards';
import {Footage} from './Footage';
import {Grain} from './Grain';
import {IgSafeOverlay} from './IgSafeOverlay';
import {Wash} from './Wash';

/** One reel, described as data (guide §1). */
export const Reel: React.FC<ReelProps> = (p) => {
  const accent = p.accent ?? brand.accent;
  const accentText = p.accentText ?? brand.accentText;
  const first = p.words[0]?.start ?? 0;
  const last = p.words[p.words.length - 1]?.end ?? 0;
  const topWins = p.cards.filter((c) => (c.slot ?? 'top') === 'top' || c.slot === 'side').map((c) => [c.start, c.end] as [number, number]);
  const bottomWins: [number, number][] = p.words.length ? [[first, last]] : [];

  return (
    <Fonts>
      <AbsoluteFill style={{backgroundColor: brand.black}}>
        <Footage src={p.video} camera={p.camera} handheld={p.handheld} volume={p.voiceVolume} />
        <Wash top={topWins} bottom={bottomWins} />
        <Grain opacity={p.grain} />

        {p.cards.map((c, i) => {
          const from = sec(c.start);
          const dur = Math.max(1, sec(c.end) - from);
          return (
            <Sequence key={c.id ?? i} from={from} durationInFrames={dur} name={`${c.type}: ${c.id ?? i}`} layout="none">
              {renderCard(c, {accent, accentText, dur})}
            </Sequence>
          );
        })}

        {/* Captions run first word to last. Never muted (guide §9). */}
        <Captions words={p.words} emphasis={p.emphasis} y={p.captionY} accentText={accentText} />

        {brand.logo ? <Logo src={brand.logo} hideDuring={topWins} /> : null}

        {p.sfx.map((s, i) => (
          <Sequence key={i} from={sec(s.at)} name={`sfx ${s.note ?? s.src}`} layout="none">
            <Audio src={staticFile(s.src)} volume={s.volume} />
          </Sequence>
        ))}
        {p.music ? <Audio src={staticFile(p.music.src)} volume={p.music.volume} loop /> : null}

        {p.igOverlay ? <IgSafeOverlay safe={p.safe} /> : null}
      </AbsoluteFill>
    </Fonts>
  );
};

/**
 * The mark sits in the top-right corner of the readable box and steps aside
 * while a top card owns that band. No chip behind it — a drop-shadow is
 * enough (guide §6).
 */
const Logo: React.FC<{src: string; hideDuring: [number, number][]}> = ({src, hideDuring}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const hidden = Math.max(
    0,
    ...hideDuring.map(([s, e]) => interpolate(t, [s - 0.2, s, e, e + 0.2], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})),
  );
  return (
    <Img
      src={staticFile(src)}
      style={{position: 'absolute', right: 72, top: 444, height: 86, opacity: 0.92 * (1 - hidden), filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.6))'}}
    />
  );
};
