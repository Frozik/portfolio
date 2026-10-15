import { utf8 } from '@frozik/vault/crypto/bytes';

/** The demo passport's scan: drawn here, marked a specimen, nothing real in it. */
export const DEMO_SCAN = {
  name: 'passport-specimen.svg',
  mime: 'image/svg+xml',
  bytes: utf8(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
  <rect width="400" height="280" rx="16" fill="#1e3a5f"/>
  <rect x="24" y="64" width="110" height="140" rx="8" fill="#9fb4cc"/>
  <circle cx="79" cy="118" r="28" fill="#5c7a99"/>
  <rect x="44" y="154" width="70" height="36" rx="18" fill="#5c7a99"/>
  <text x="24" y="44" fill="#e8eef5" font-family="sans-serif" font-size="20" font-weight="700">PASSPORT</text>
  <text x="156" y="92" fill="#e8eef5" font-family="monospace" font-size="16">JANE DOE</text>
  <text x="156" y="122" fill="#e8eef5" font-family="monospace" font-size="16">X1234567</text>
  <text x="156" y="152" fill="#e8eef5" font-family="monospace" font-size="14">EXAMPLE STATE</text>
  <text x="200" y="250" fill="#f87171" font-family="sans-serif" font-size="28" font-weight="700" text-anchor="middle" transform="rotate(-12 200 250)">SPECIMEN</text>
</svg>
`),
} as const;
