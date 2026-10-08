/**
 * Recipe Hub brand artwork: the logo and the hand-drawn ingredient stickers from the brand
 * board (docs/brand/recipe-hub-brand-board.webp). Every piece is inline SVG on a 64 × 64 grid
 * and takes its colours from the --c-* brand tokens in styles.css.
 */
import type { CSSProperties, ReactElement } from "react";

export const DOODLES = ["lemon", "radish", "tomato", "sprig", "flower", "heart", "avocado"] as const;
export type Doodle = (typeof DOODLES)[number];

const ART: Record<Doodle, ReactElement> = {
  lemon: (
    <g transform="rotate(-28 32 32)">
      <path
        fill="var(--c-sun)"
        d="M4 32.5q2.2-3.2 5.4-4.1C12.3 19.6 21 15 32.2 15.3c11 .3 19.6 4.6 22.6 13.3q3.3.9 5.2 4-2 3-5.3 3.7c-2.9 8.6-11.6 13-22.7 13.2C21 49.6 12.2 45 9.3 36.6Q6 35.6 4 32.5z"
      />
      <path fill="var(--c-sun-deep)" d="M14 39c4 5 11 7 19 7 7 0 13-2 17-6-6 2-11 3-17 3-7 0-13-1-19-4z" opacity="0.55" />
      <path fill="#fff" d="M17 25c3-3 8-5 13-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <g fill="var(--c-sun-deep)" opacity="0.6">
        <circle cx="40" cy="27" r="0.9" />
        <circle cx="45" cy="31" r="0.9" />
        <circle cx="36" cy="33" r="0.9" />
        <circle cx="25" cy="35" r="0.9" />
      </g>
    </g>
  ),
  radish: (
    <g>
      <path fill="var(--c-leaf)" d="M30.5 30C20 27 13.5 17 17 4c9 2.5 15.5 12 13.5 26z" />
      <path fill="var(--c-olive-leaf)" d="M33.5 30.5c1-12 7-20.5 18-22.5 1.5 11.5-5.5 20.5-18 22.5z" />
      <path fill="none" stroke="var(--c-forest)" strokeWidth="1.2" strokeLinecap="round" d="M30 29C25 22 21 15 18.5 7M34.5 29.5c4-6 8.5-12 15-19" opacity="0.55" />
      <path
        fill="var(--c-pink)"
        d="M32 27c9 0 15 6.5 15 14.5C47 50 40.5 55 34 56.5c.6 2.5 2 4.5 4 6-3.5-.2-5.8-2.4-6.6-6C25 55.5 17 50 17 41.5 17 33.5 23 27 32 27z"
      />
      <path fill="#fff" d="M22 39c1-4.5 4-7.5 8.5-8.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
    </g>
  ),
  tomato: (
    <g>
      <path
        fill="var(--c-tomato)"
        d="M32 17c13 0 24 8 24 20 0 11-10 20-24 20S7.5 49 7.5 37.5C7.5 25 18.5 17 32 17z"
      />
      <path fill="#fff" d="M15 33c1.5-5 5.5-8.5 11-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
      <path
        fill="var(--c-leaf)"
        d="M32 21.5l-4.5 4.2 1-5.6-6.5 1 5-4.2-4-3.6 6.3.7.6-5 2.6 5 3.6-3.8.3 5.4 6.2-.4-4.5 4.3 5.3 3.4-6.5.4.6 5.8z"
      />
      <path fill="none" stroke="var(--c-leaf)" strokeWidth="2.4" strokeLinecap="round" d="M32 14c0-3 1-5.5 3-7" />
    </g>
  ),
  sprig: (
    <g fill="var(--c-leaf)">
      <path fill="none" stroke="var(--c-leaf)" strokeWidth="2.2" strokeLinecap="round" d="M14 60C24 46 33 28 46 6" />
      <path d="M21.5 49c-8 .5-13.5-3.5-15-9.5 7-1 12.5 2.5 15 9.5z" />
      <path d="M24 45c-1.5-8 1.5-14 7.5-17 2 6.5-1 13-7.5 17z" fill="var(--c-olive-leaf)" />
      <path d="M29.5 36.5c-7.5-1-12-5.5-12.5-11.5 7 0 11.5 4.5 12.5 11.5z" />
      <path d="M33 31c-.5-8 3-13.5 9.5-15.5 1 7-2.5 12.5-9.5 15.5z" fill="var(--c-olive-leaf)" />
      <path d="M37 24c-7-2-10.5-7-10.5-13 6.5 1 10.5 6 10.5 13z" />
      <path d="M42.5 13.5c1-5 4.5-8.5 10-8.5-.5 5.5-4.5 8.5-10 8.5z" />
    </g>
  ),
  flower: (
    <g fill="var(--c-lavender)">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="32" cy="17" rx="6.2" ry="13" transform={`rotate(${a + 8} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="5.5" fill="var(--c-lavender-deep)" />
    </g>
  ),
  heart: (
    <g>
      <path
        fill="var(--c-pink)"
        d="M32.5 55C20 46 9 37 9.5 25 10 16.5 16 11.5 23 12c4.5.3 7.5 3 9.5 6.5 2.3-4 6-6.8 11-6.6 7 .3 12 6 11.5 13.5C54 37.5 44 46.5 32.5 55z"
      />
      <path fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" d="M16 25c0-4 2.5-7 6-7.5" opacity="0.55" />
      <path fill="none" stroke="var(--c-sun)" strokeWidth="2.6" strokeLinecap="round" d="M53 8l-3 4M59 15l-5 2M58.5 24l-4-.5" />
    </g>
  ),
  avocado: (
    <g transform="rotate(14 32 32)">
      <path
        fill="var(--c-olive-leaf)"
        d="M32 4c7 0 10.5 6 12.5 13.5C46.5 25 54 31 54 42c0 11-9.5 18.5-22 18.5S10 53 10 42c0-11 7.5-17 9.5-24.5C21.5 10 25 4 32 4z"
      />
      <path
        fill="var(--c-lime)"
        d="M32 10c4.5 0 7 4.5 8.5 10 1.5 6 7.5 11 7.5 21 0 8.5-7 14-16 14s-16-5.5-16-14c0-10 6-15 7.5-21C25 14.5 27.5 10 32 10z"
      />
      <circle cx="32" cy="40" r="8.5" fill="var(--c-pit)" />
      <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" d="M28 36.5c.8-1.6 2.2-2.6 4-2.8" opacity="0.5" />
    </g>
  ),
};

/** One hand-drawn ingredient sticker with its white die-cut edge. Decorative: hidden from assistive tech. */
export function Sticker({ name, size = 48, className = "", style }: { name: Doodle; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`sticker ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <g className="sticker-edge">{ART[name]}</g>
      {ART[name]}
    </svg>
  );
}

/** The logo illustration: a lemon in front of a leafy radish, with sun dashes. */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`brand-art ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform="translate(19 1) scale(0.74)">{ART.radish}</g>
      <g transform="translate(1 19) scale(0.66) rotate(-42 32 32)">
        <g className="mark-edge">{ART.lemon}</g>
        {ART.lemon}
      </g>
      <path fill="none" stroke="var(--c-sun)" strokeWidth="2.4" strokeLinecap="round" d="M2.5 26l4 2.5M1.5 34h4.5M57.5 30l4.5-2M58 37.5l4 1.5" />
    </svg>
  );
}

/** Scattered stickers used as a decorative cluster beside a heading. */
export function StickerCluster({ className = "" }: { className?: string }) {
  return (
    <div className={`sticker-cluster ${className}`} aria-hidden="true">
      <Sticker name="tomato" size={76} className="sc-tomato" />
      <Sticker name="radish" size={84} className="sc-radish" />
      <Sticker name="lemon" size={70} className="sc-lemon" />
      <Sticker name="flower" size={46} className="sc-flower" />
      <Sticker name="sprig" size={64} className="sc-sprig" />
      <Sticker name="avocado" size={54} className="sc-avocado" />
    </div>
  );
}

/** Pick a sticker for anything with a stable id, so the same recipe always gets the same one. */
export function doodleFor(key: string): Doodle {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return DOODLES[Math.abs(h) % DOODLES.length];
}
