import React from 'react';
import {AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {noise2D} from '@remotion/noise';
import {brand} from '../brand';
import type {CameraMove} from '../types';

/** Current scale + origin from the camera list. Between moves the frame rests at 1. */
export const cameraAt = (t: number, moves: CameraMove[]) => {
  for (const m of moves) {
    if (t < m.start || t > m.end) continue;
    const e = m.ease ?? 0.35;
    const k = interpolate(t, [m.start, m.start + e, m.end - e, m.end], [0, 1, 1, 0], {
      easing: Easing.bezier(0.33, 0, 0.2, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return {scale: 1 + (Math.max(1, m.scale) - 1) * k, ox: m.originX ?? 50, oy: m.originY ?? 40};
  }
  return {scale: 1, ox: 50, oy: 40};
};

/**
 * The speaker. Pass a path relative to public/ — this component calls
 * staticFile() itself. Scale only ever goes up (object-fit: cover).
 */
export const Footage: React.FC<{
  src: string | null;
  camera: CameraMove[];
  handheld: number;
  volume: number;
}> = ({src, camera, handheld, volume}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {scale, ox, oy} = cameraAt(frame / fps, camera);
  // Slow noise drift so eased moves stop reading as "template". Extra scale hides the edges.
  const dx = handheld ? noise2D('hx', frame / 90, 0) * handheld : 0;
  const dy = handheld ? noise2D('hy', 0, frame / 90) * handheld : 0;
  const pad = handheld ? 1 + (handheld * 2.2) / 1080 : 1;

  return (
    <AbsoluteFill style={{backgroundColor: brand.surface, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate(${dx}px, ${dy}px) scale(${scale * pad})`,
          transformOrigin: `${ox}% ${oy}%`,
        }}
      >
        {src ? (
          <OffthreadVideo src={staticFile(src)} volume={volume} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          <Placeholder />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Stand-in for a reel that has no assembled master yet: a silhouette at the target framing. */
const Placeholder: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 35%, #3a3d47 0%, ${brand.surface} 70%)`}}>
    {/* head top ~30 %, chin ~62 % — the framing the guide asks the camera operator for */}
    <div style={{position: 'absolute', left: 390, top: 576, width: 300, height: 380, borderRadius: '48%', background: '#555a66'}} />
    <div style={{position: 'absolute', left: 190, top: 1010, width: 700, height: 1000, borderRadius: '45% 45% 0 0', background: '#4a4f5a'}} />
  </AbsoluteFill>
);
