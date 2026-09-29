import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand} from '../brand';
import {SAFE} from '../ig-safe';
import type {Slot} from '../types';

/** Every slot lives inside the readable box y 432–1430, x 60–1020 (guide §8.9). */
const SLOTS: Record<Slot, React.CSSProperties> = {
  top: {left: SAFE.left, width: SAFE.right - SAFE.left, top: SAFE.top, alignItems: 'center'},
  center: {left: SAFE.left, width: SAFE.right - SAFE.left, top: 700, alignItems: 'center'},
  lower: {left: SAFE.left, width: 820, top: 1150, alignItems: 'flex-start'},
  // beside the speaker, where they gesture — measure per shoot and adjust
  side: {left: 560, width: 460, top: SAFE.top, alignItems: 'flex-start'},
};

/**
 * Enter with a short slam on the word, leave on the next beat. Must be
 * mounted inside a <Sequence>, so useCurrentFrame() is LOCAL (guide §17).
 */
export const CardShell: React.FC<{slot: Slot; dur: number; children: React.ReactNode}> = ({slot, dur, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inn = spring({frame: f, fps, config: {damping: 14, stiffness: 220, mass: 0.6}});
  const out = interpolate(f, [dur - 6, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(inn, [0, 1], [1.18, 1]);
  const blur = interpolate(f, [0, 5], [10, 0], {extrapolateRight: 'clamp'}); // decaying blur = slam weight
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        ...SLOTS[slot],
        opacity: Math.min(inn * 1.4, 1) * out,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** A solid accent slab with text on top — the "fill" colour slot. */
export const Slab: React.FC<{bg: string; fg: string; size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  bg,
  fg,
  size,
  children,
  style,
}) => (
  <div
    style={{
      fontFamily: brand.font,
      background: bg,
      color: fg,
      fontSize: size,
      fontWeight: 900,
      lineHeight: 1.05,
      padding: `${size * 0.22}px ${size * 0.38}px`,
      textTransform: 'uppercase',
      letterSpacing: -1,
      boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      ...style,
    }}
  >
    {children}
  </div>
);
