import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
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

        {brand.logo ? (
          <img src={staticFile(brand.logo)} style={{position: 'absolute', right: 70, top: 440, height: 64, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))'}} />
        ) : null}

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
