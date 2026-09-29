import React, {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

const FACES = [
  {family: 'Montserrat', file: 'fonts/Montserrat-500.woff2', weight: '500'},
  {family: 'Montserrat', file: 'fonts/Montserrat-700.woff2', weight: '700'},
  {family: 'Montserrat', file: 'fonts/Montserrat-800.woff2', weight: '800'},
  {family: 'Montserrat', file: 'fonts/Montserrat-900.woff2', weight: '900'},
  {family: 'Inter', file: 'fonts/Inter-500.woff2', weight: '500'},
  {family: 'Inter', file: 'fonts/Inter-700.woff2', weight: '700'},
  {family: 'Inter', file: 'fonts/Inter-900.woff2', weight: '900'},
];

/**
 * Loads fonts INSIDE a component. Loading at module scope makes stills pass
 * and video renders fail (guide §6). Never use a font CDN.
 */
export const Fonts: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('Loading fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(
      FACES.map((f) => loadFont({family: f.family, url: staticFile(f.file), weight: f.weight})),
    )
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch(cancelRender);
  }, [handle]);
  return ready ? <>{children}</> : null;
};
