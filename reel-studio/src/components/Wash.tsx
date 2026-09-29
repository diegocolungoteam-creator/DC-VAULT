import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

type Window = [number, number];

const gate = (t: number, wins: Window[], fade = 0.25) =>
  Math.max(
    0,
    ...wins.map(([s, e]) =>
      interpolate(t, [s - fade, s, e, e + fade], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    ),
  );

/**
 * Legibility wash that follows the graphics in space AND time (guide §13).
 * Top and bottom are separate so the speaker isn't dimmed when there is no
 * text in that band.
 */
export const Wash: React.FC<{top: Window[]; bottom: Window[]; strength?: number}> = ({top, bottom, strength = 0.55}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          opacity: gate(t, top),
          background: `linear-gradient(180deg, rgba(0,0,0,${strength}) 0%, rgba(0,0,0,${strength * 0.6}) 22%, rgba(0,0,0,0) 36%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: gate(t, bottom),
          background: `linear-gradient(0deg, rgba(0,0,0,${strength}) 0%, rgba(0,0,0,${strength * 0.7}) 30%, rgba(0,0,0,0) 55%)`,
        }}
      />
    </AbsoluteFill>
  );
};
