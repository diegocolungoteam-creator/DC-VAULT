import React from 'react';
import {AbsoluteFill} from 'remotion';
import {H} from '../brand';
import {CAPTION_X, IG_UI, SAFE} from '../ig-safe';

/**
 * Draws Instagram's UI boxes (red), the readable box (green) and the measured
 * speaker band (yellow). Mounted by the `<reel>-ig` composition — shoot one
 * still of it before every real render.
 */
export const IgSafeOverlay: React.FC<{safe: {headTop: number; chinBottom: number}}> = ({safe}) => (
  <AbsoluteFill style={{pointerEvents: 'none', fontFamily: 'Inter, sans-serif'}}>
    {IG_UI.map((b) => (
      <div
        key={b.label}
        style={{
          position: 'absolute',
          left: b.x,
          top: b.y,
          width: b.w,
          height: b.h,
          background: 'rgba(255,40,40,0.28)',
          outline: '2px solid rgba(255,60,60,0.9)',
          color: '#fff',
          fontSize: 22,
          padding: 4,
        }}
      >
        {b.label}
      </div>
    ))}
    <div
      style={{
        position: 'absolute',
        left: SAFE.left,
        top: SAFE.top,
        width: SAFE.right - SAFE.left,
        height: SAFE.bottom - SAFE.top,
        border: '4px dashed #3CFF7A',
      }}
    />
    <div style={{position: 'absolute', left: CAPTION_X.left, width: CAPTION_X.right - CAPTION_X.left, top: SAFE.top, height: SAFE.bottom - SAFE.top, borderLeft: '2px dotted #3CFF7A', borderRight: '2px dotted #3CFF7A'}} />
    {[safe.headTop, safe.chinBottom].map((f, i) => (
      <div key={i} style={{position: 'absolute', left: 0, right: 0, top: f * H, borderTop: '3px solid #FFD400', color: '#FFD400', fontSize: 24, paddingLeft: 8}}>
        {i === 0 ? `cabeza ${Math.round(f * 100)}%` : `barbilla más baja ${Math.round(f * 100)}%`}
      </div>
    ))}
  </AbsoluteFill>
);
