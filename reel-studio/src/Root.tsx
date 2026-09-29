import React from 'react';
import {Composition} from 'remotion';
import {FPS, H, W} from './brand';
import {BrandSheet} from './components/BrandSheet';
import {Reel} from './components/Reel';
import {REELS} from './reels/registry';

export const Root: React.FC = () => (
  <>
    <Composition id="brand" component={BrandSheet} durationInFrames={10 * FPS} fps={FPS} width={W} height={H} />
    {Object.entries(REELS).map(([id, props]) => {
      const d = Math.ceil(props.durationSec * FPS);
      return (
        <React.Fragment key={id}>
          <Composition id={id} component={Reel} durationInFrames={d} fps={FPS} width={W} height={H} defaultProps={props} />
          <Composition id={`${id}-nomusic`} component={Reel} durationInFrames={d} fps={FPS} width={W} height={H} defaultProps={{...props, music: null}} />
          <Composition id={`${id}-ig`} component={Reel} durationInFrames={d} fps={FPS} width={W} height={H} defaultProps={{...props, igOverlay: true}} />
        </React.Fragment>
      );
    })}
  </>
);
