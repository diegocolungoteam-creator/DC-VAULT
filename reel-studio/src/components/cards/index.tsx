import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand} from '../../brand';
import type {Card} from '../../types';
import {CardShell, Slab} from '../CardShell';

type Ctx = {accent: string; accentText: string; dur: number};

const shadow = '0 4px 18px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.6)';
const onAccent = brand.onAccent;

/** The opening claim. `highlight` is the word that goes on the accent slab. */
export const HookCard: React.FC<Extract<Card, {type: 'hook'}> & Ctx> = ({text, highlight, slot = 'top', dur, accent}) => {
  const parts = highlight ? text.split(highlight) : [text];
  return (
    <CardShell slot={slot} dur={dur}>
      <div style={{fontFamily: brand.font, fontWeight: 900, fontSize: 84, lineHeight: 1.08, color: brand.white, textAlign: 'center', textTransform: 'uppercase', textShadow: shadow}}>
        {parts[0]}
        {highlight ? (
          <Slab bg={accent} fg={onAccent} size={84} style={{display: 'inline-block', margin: '6px 0'}}>
            {highlight}
          </Slab>
        ) : null}
        {parts[1]}
      </div>
    </CardShell>
  );
};

/** Pull-quote. */
export const QuoteCard: React.FC<Extract<Card, {type: 'quote'}> & Ctx> = ({text, author, slot = 'center', dur, accent}) => (
  <CardShell slot={slot} dur={dur}>
    <div style={{fontFamily: brand.font, background: 'rgba(11,11,12,0.82)', borderLeft: `14px solid ${accent}`, padding: '36px 44px', maxWidth: 900}}>
      <div style={{fontWeight: 700, fontSize: 60, lineHeight: 1.15, color: brand.white}}>“{text}”</div>
      {author ? <div style={{fontWeight: 500, fontSize: 34, color: '#C9CAD1', marginTop: 18}}>— {author}</div> : null}
    </div>
  </CardShell>
);

/**
 * A wrong idea, struck through. The strike is its own bar — CSS line-through
 * paints in the text colour and vanishes (guide §9).
 */
export const StrikeCard: React.FC<Extract<Card, {type: 'strike'}> & Ctx> = ({wrong, right, slot = 'top', dur, accent, accentText}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const strike = interpolate(f, [8, 16], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const r = spring({frame: f - 20, fps, config: {damping: 14}});
  return (
    <CardShell slot={slot} dur={dur}>
      <div style={{position: 'relative', fontFamily: brand.font, fontWeight: 900, fontSize: 78, color: brand.white, textTransform: 'uppercase', textShadow: shadow, opacity: 0.9}}>
        {wrong}
        <div style={{position: 'absolute', left: -12, top: '50%', height: 14, width: `calc(${strike}% + 24px)`, background: accent, transform: 'translateY(-50%) rotate(-3deg)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)'}} />
      </div>
      {right ? (
        <div style={{fontFamily: brand.font, fontWeight: 900, fontSize: 78, color: accentText, textTransform: 'uppercase', textShadow: shadow, marginTop: 10, opacity: r, transform: `translateY(${(1 - r) * 30}px)`}}>
          {right}
        </div>
      ) : null}
    </CardShell>
  );
};

/**
 * ONE / TWO / THREE. Shows only the item being said (with progress dots) so
 * the card stays one line tall in the top slot and never covers the face.
 */
export const NumberCard: React.FC<Extract<Card, {type: 'number'}> & Ctx> = ({label, items, at, start, slot = 'top', dur, accent, accentText}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = start + f / fps;
  const times = at ?? items.map((_, i) => start + (i * (dur / fps)) / items.length);
  const idx = Math.max(0, times.filter((x) => t >= x).length - 1);
  const s = spring({frame: f - Math.round((times[idx] - start) * fps), fps, config: {damping: 15}});
  return (
    <CardShell slot={slot} dur={dur}>
      <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
        <Slab bg={accent} fg={onAccent} size={52}>
          {label}
        </Slab>
        <div style={{display: 'flex', gap: 10}}>
          {items.map((_, i) => (
            <div key={i} style={{width: 18, height: 18, borderRadius: 9, background: i <= idx ? accentText : 'rgba(255,255,255,0.35)'}} />
          ))}
        </div>
      </div>
      <div style={{marginTop: 14, fontFamily: brand.font, fontWeight: 900, fontSize: 62, color: brand.white, textTransform: 'uppercase', textShadow: shadow, opacity: s, transform: `translateY(${(1 - s) * 24}px)`, textAlign: 'center'}}>
        {items[idx]}
      </div>
    </CardShell>
  );
};

/**
 * The CTA keyword — the biggest, strongest thing on screen. Lead and keyword
 * share one row so the card stays above the eyes in the top slot.
 */
export const CtaCard: React.FC<Extract<Card, {type: 'cta'}> & Ctx> = ({keyword, lead = 'Comenta', sub, slot = 'top', dur, accent}) => {
  const f = useCurrentFrame();
  const pulse = 1 + Math.sin(f / 7) * 0.015;
  return (
    <CardShell slot={slot} dur={dur}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
        <div style={{fontFamily: brand.font, fontWeight: 900, fontSize: 58, color: brand.white, textTransform: 'uppercase', textShadow: shadow}}>{lead}</div>
        <Slab bg={accent} fg={onAccent} size={112} style={{transform: `scale(${pulse})`, letterSpacing: -2}}>
          {keyword}
        </Slab>
      </div>
      {sub ? <div style={{fontFamily: brand.font, fontWeight: 700, fontSize: 40, color: brand.white, textShadow: shadow, marginTop: 14, textAlign: 'center'}}>{sub}</div> : null}
    </CardShell>
  );
};

export const renderCard = (c: Card, ctx: Ctx) => {
  switch (c.type) {
    case 'hook':
      return <HookCard {...c} {...ctx} />;
    case 'quote':
      return <QuoteCard {...c} {...ctx} />;
    case 'strike':
      return <StrikeCard {...c} {...ctx} />;
    case 'number':
      return <NumberCard {...c} {...ctx} />;
    case 'cta':
      return <CtaCard {...c} {...ctx} />;
  }
};
