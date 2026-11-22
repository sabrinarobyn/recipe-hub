/**
 * Recipe Hub illustrations: flat, cut-paper style fruit and vegetables on a 64 × 64 grid.
 * Solid shapes with slightly uneven edges and a few darker "cut" details, no outlines.
 * Colours come from the --i-* tokens in styles.css so they stay consistent in both themes.
 */
import type { CSSProperties, ReactElement } from "react";

export const DOODLES = ["tomato", "lemon", "radish", "pumpkin", "aubergine", "pear", "papaya", "chilli", "fennel", "flower"] as const;
export type Doodle = (typeof DOODLES)[number];

const ART: Record<Doodle, ReactElement> = {
  tomato: (
    <g>
      <path fill="var(--i-tomato)" d="M32 15c13.5-.4 25 8.6 24.6 21.6-.4 12.3-11 20.6-24.4 20.9C18.4 57.8 7.3 49.9 7.5 37 7.7 24 18.6 15.4 32 15z" />
      <path fill="var(--i-tomato-deep)" d="M11 42c4 8 12.5 12.5 21.5 12.3 8.6-.2 16.2-4.2 20-11.4-6 4.1-12.6 6-20.2 6-8.2 0-15.2-2.3-21.3-6.9z" />
      <path fill="var(--i-leaf)" d="M32 22l-6.8 4.6 2-7.4-8.2-.4 6.6-4.2-4.2-6 7.2 2.6L31.6 4l3 7.4 6.6-3.6-2.8 7 8.4 1-7.4 3.6 3.8 6.6-7.6-3.4z" />
      <path fill="var(--i-leaf-deep)" d="M30.6 11.6c-.5-3.5.6-6.6 3.4-8.6l1.8 1.6c-2.4 1.8-3.2 4.2-2.8 7.2z" />
    </g>
  ),
  lemon: (
    <g transform="rotate(-24 32 32)">
      <path fill="var(--i-lemon)" d="M5 33c1.6-2.6 3.8-4 6.6-4.6C14.5 19.8 22.7 15.6 32.4 15.8c10.4.2 18.2 4.4 21.2 12.8 2.8.6 4.8 2 6.2 4.4-1.6 2.4-3.6 3.8-6.4 4.2-3 8.4-10.8 12.6-21.2 12.8C22 50 14.2 46 11.4 37.6 8.6 37 6.6 35.6 5 33z" />
      <path fill="var(--i-lemon-deep)" d="M13.4 40c4.4 5.8 11 8.4 19.4 8.2 8-.2 14-3 18-8-5.8 2.4-11.6 3.4-18.2 3.4-7 0-13.4-1.2-19.2-3.6z" />
      <path fill="var(--i-cream)" opacity="0.7" d="M18 26.4c3.4-3.6 8.2-5.4 13.6-5.6l.2 2.6c-4.8.2-8.8 1.8-11.8 4.8z" />
    </g>
  ),
  radish: (
    <g>
      <path fill="var(--i-leaf)" d="M30 29C19.4 26.4 13 16.6 15.8 4.4c10 2.4 16.2 12 14.2 24.6z" />
      <path fill="var(--i-leaf-deep)" d="M34 29.6c.6-11.6 6.8-20 17.8-22.2 1.4 11-5.4 20-17.8 22.2z" />
      <path fill="var(--i-radish)" d="M32 26.4c9.4-.2 15.6 6.2 15.4 14.8-.2 8.2-6.4 13.2-13 14.6.6 2.6 1.8 4.6 3.6 6.2-3.6-.2-6-2.4-6.8-6C24.4 55 16.6 49.6 16.8 41c.2-8.4 6.2-14.4 15.2-14.6z" />
      <path fill="var(--i-radish-deep)" d="M20 45.4c2.6 5 7.4 7.6 12.6 7.8 4.8.2 9.4-1.8 12.2-5.8-4 1.6-8 2.2-12.4 2-4.4-.2-8.6-1.6-12.4-4z" />
    </g>
  ),
  pumpkin: (
    <g>
      <path fill="var(--i-pumpkin)" d="M20.2 20.6c4.6-1.6 8.4-.4 11.8 1.6 3.4-2 7.4-3.2 11.8-1.6 9.6 1.4 15.2 9 14.6 19-.6 10.4-8.4 17.6-17.2 17.4-3.4 0-6.4-1-9.2-2.6-2.8 1.6-5.8 2.6-9.2 2.6C13.8 57.2 6 50 5.4 39.6c-.6-10 5.2-17.6 14.8-19z" />
      <path fill="var(--i-pumpkin-deep)" d="M32 22.2c-4.4 4.6-6.4 10.8-6.4 17.4 0 6.4 2.2 11.8 6.4 15.4 4.2-3.6 6.4-9 6.4-15.4 0-6.6-2-12.8-6.4-17.4z" />
      <path fill="var(--i-stem)" d="M30.2 22.6c.2-5.4-1.4-9.8-4.6-13l3.4-2.6c3.8 3.8 5.6 9.2 5.2 15.4z" />
      <path fill="var(--i-leaf)" d="M33.8 14.8c3.2-5 8.6-6.6 14-4.6-2.8 5-8 6.8-14 4.6z" />
    </g>
  ),
  aubergine: (
    <g transform="rotate(18 32 32)">
      <path fill="var(--i-cobalt)" d="M28.6 18.4c5.6-.6 9.8 2.6 11 8.4 1.6 7.6 9.4 11.8 9.6 20.4.2 8.6-6.8 14.6-16 14.6-9.6 0-16.6-6.4-16.2-15.6.4-8 5-11 5.6-17.4.4-6 1.8-9.8 6-10.4z" />
      <path fill="var(--i-cobalt-deep)" d="M20.4 50c3 5.8 8 8.6 13.6 8.4 4.6-.2 8.6-2.2 11.2-5.8-4.2 1.4-8.4 1.8-12.8 1.2-4.8-.6-8.8-1.8-12-3.8z" />
      <path fill="var(--i-leaf)" d="M23.4 19.4c2.6-4.2 7.2-6 12-4.6 3.4 1 5.8 3.6 6.8 7-2.6-1.2-5-1.6-7.2-1.4l1.4 5c-2.4-1.4-4.6-2.8-6.6-4.6l-2.6 4.8c-.6-2.2-.4-4.4.6-6.6-1.6 0-3 .2-4.4.4z" />
      <path fill="var(--i-leaf-deep)" d="M30.2 15.2c-.4-4 .6-7.8 3.2-10.8l2.4 1.8c-2.2 2.6-3 5.4-2.8 9z" />
    </g>
  ),
  pear: (
    <g transform="rotate(-10 32 32)">
      <path fill="var(--i-pear)" d="M31 13.6c5 0 7.6 4 8.4 9.4.8 5.4 4.4 8.2 7.6 12.8 2.8 4 3.6 8.2 2.4 12.4-2 7.2-9 11.4-17.4 11.4S15.8 55.4 14 48.2c-1.2-4.6 0-9 3-12.8 3.4-4.4 6.4-7.2 7.2-12.4.8-5.4 2.8-9.4 6.8-9.4z" />
      <path fill="var(--i-pear-deep)" d="M17.4 51c3.4 4.8 8.8 7 14.6 7 5.6 0 10.6-2.2 13.8-6.6-4.4 1.6-9.2 2.4-14 2.2-5.2-.2-10-1-14.4-2.6z" />
      <path fill="var(--i-stem)" d="M30.6 14.4c-.2-3.8.8-7.4 3-10.4l2.4 1.6c-1.8 2.6-2.6 5.4-2.4 8.8z" />
      <path fill="var(--i-leaf)" d="M34.2 8.6c3.6-3.4 8.4-4 12.4-1.6-3.2 3.6-8 4.2-12.4 1.6z" />
    </g>
  ),
  papaya: (
    <g transform="rotate(-30 32 32)">
      <path fill="var(--i-leaf)" d="M32 6.4c12.4 0 21 11.4 21 25.8S44.4 57.6 32 57.6 11 46.6 11 32.2 19.6 6.4 32 6.4z" />
      <path fill="var(--i-papaya)" d="M32 9.6c10.6 0 18 10.2 18 22.6S42.6 54.6 32 54.6 14 44.6 14 32.2 21.4 9.6 32 9.6z" />
      <path fill="var(--i-papaya-light)" d="M32 18.4c6 0 9.6 6.4 9.6 14.2S37.8 46 32 46s-9.6-5.6-9.6-13.4S26 18.4 32 18.4z" />
      <g fill="var(--i-seed)">
        <circle cx="29.6" cy="26" r="1.9" />
        <circle cx="34.6" cy="27.2" r="1.9" />
        <circle cx="31.4" cy="31" r="1.9" />
        <circle cx="35.8" cy="32.6" r="1.9" />
        <circle cx="28.2" cy="34.4" r="1.9" />
        <circle cx="32.6" cy="36.4" r="1.9" />
        <circle cx="30.4" cy="40.2" r="1.9" />
        <circle cx="34.8" cy="40.4" r="1.7" />
      </g>
    </g>
  ),
  chilli: (
    <g>
      <path fill="var(--i-red)" d="M17.4 22.6c3.6-2.2 7.6-1.6 9.6 1.8 3.2 5.6 4.6 13 10.2 18.6 4.6 4.6 10.4 6.6 16.4 7-5 4.8-13 6.6-20.6 3.6C23.4 50 16.6 41.6 14.6 32.6c-.8-4 .2-8 2.8-10z" />
      <path fill="var(--i-red-deep)" d="M17.2 38.6c3.2 6.8 8.6 11.6 15 13.8 6 2 12 1.6 17.4-1.2-6 .4-11.6-.8-16.6-3.4-6.2-3.2-11.2-6.6-15.8-9.2z" />
      <path fill="var(--i-leaf)" d="M14.8 23.4c1.6-3 4.6-4.6 8-4.6 2.4 0 4.4 1 5.8 2.8-2 .6-4 1.6-5.6 3.2-1.6-1.2-4.6-1.6-8.2-1.4z" />
      <path fill="var(--i-leaf-deep)" d="M20.4 19.6c-1.2-3.6-.8-7.2 1.2-10.4l2.6 1.4c-1.6 2.6-2 5.4-1 8.4z" />
    </g>
  ),
  fennel: (
    <g fill="none" strokeLinecap="round">
      <path stroke="var(--i-leaf)" strokeWidth="2.6" d="M14 60c6-13 12-27 21-40M24 39c-6-3-10-8-12-14M28 32c4-6 9-9 15-10M31 26c-3-5-4-10-3-16M35 21c5-3 11-3 16-1" />
      <g fill="var(--i-pumpkin)">
        <circle cx="12" cy="24" r="2.6" />
        <circle cx="44" cy="21.4" r="2.6" />
        <circle cx="28" cy="9.4" r="2.6" />
        <circle cx="51.6" cy="19.4" r="2.4" />
        <circle cx="38.4" cy="16" r="2.4" />
        <circle cx="18.6" cy="28.6" r="2.2" />
      </g>
    </g>
  ),
  flower: (
    <g>
      <g fill="var(--i-cobalt)">
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} transform={`rotate(${a + 10} 32 32)`} d="M32 31c-7.4 0-11.6-6.4-11-12.6.6-6 5.2-10.2 11-10.2s10.4 4.2 11 10.2c.6 6.2-3.6 12.6-11 12.6z" />
        ))}
      </g>
      <circle cx="32" cy="32" r="7.2" fill="var(--i-cream)" />
      <circle cx="32" cy="32" r="3.4" fill="var(--i-pumpkin)" />
    </g>
  ),
};

/** One cut-paper illustration. Decorative: hidden from assistive tech. */
export function Sticker({ name, size = 48, className = "", style }: { name: Doodle; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`sticker ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" style={style}>
      {ART[name]}
    </svg>
  );
}

/** The logo: a papaya half and a tomato, overlapping. */
export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`brand-art ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <g transform="translate(-2 -2) scale(0.78)">{ART.papaya}</g>
      <g transform="translate(22 22) scale(0.64)">{ART.tomato}</g>
    </svg>
  );
}

/** A spill of produce, used beside the big headings. */
export function StickerCluster({ className = "" }: { className?: string }) {
  return (
    <div className={`sticker-cluster ${className}`} aria-hidden="true">
      <Sticker name="pumpkin" size={128} className="sc-pumpkin" />
      <Sticker name="aubergine" size={116} className="sc-aubergine" />
      <Sticker name="tomato" size={84} className="sc-tomato" />
      <Sticker name="pear" size={92} className="sc-pear" />
      <Sticker name="flower" size={62} className="sc-flower" />
      <Sticker name="radish" size={72} className="sc-radish" />
      <Sticker name="lemon" size={74} className="sc-lemon" />
      <Sticker name="fennel" size={70} className="sc-fennel" />
      <Sticker name="chilli" size={58} className="sc-chilli" />
    </div>
  );
}
