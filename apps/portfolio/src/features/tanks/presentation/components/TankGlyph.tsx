import { memo } from 'react';

/** Lucide has no tank, and a generic vehicle icon would not read as "one enemy left". */
export const TankGlyph = memo(({ className }: { readonly className?: string }) => {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={className}>
      <path fill="currentColor" d="M1 4h3v10H1zM12 4h3v10h-3zM4.5 6h7v8h-7zM7 1h2v6H7z" />
    </svg>
  );
});
