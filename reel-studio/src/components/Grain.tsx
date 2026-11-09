import React from 'react';
import {AbsoluteFill, Loop, OffthreadVideo, staticFile, useVideoConfig} from 'remotion';

/**
 * Film grain from the pack, screen-blended. Costs ~40 % render time.
 * Put a native-H.264 grain clip at public/fx/grain.mp4 (GRAIN_SECONDS long).
 * mixBlendMode lives on the CONTAINER — on the inner video it composites
 * against an empty stacking context and renders opaque (guide §17).
 */
const GRAIN_SECONDS = 5;

export const Grain: React.FC<{opacity: number}> = ({opacity}) => {
  const {fps} = useVideoConfig();
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity, pointerEvents: 'none'}}>
      <Loop durationInFrames={GRAIN_SECONDS * fps}>
        <OffthreadVideo src={staticFile('fx/grain.mp4')} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </Loop>
    </AbsoluteFill>
  );
};
