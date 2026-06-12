/** Minimal structural type for Vite's import.meta.env — avoids depending on vite/client types in the lib */
type TViteImportMeta = ImportMeta & { readonly env?: { readonly PROD?: boolean } };

/**
 * True only in a production Vite build (`import.meta.env.PROD` is statically
 * replaced at build time; in dev and Vitest it is a live object with
 * PROD === false).
 *
 * Why not `process.env.NODE_ENV`: browsers have no `process` global and Vite
 * does not polyfill it — a `typeof process` guard makes the function
 * permanently false in the browser, including production bundles (verified
 * against the deployed GitHub Pages build).
 */
export function isProduction(): boolean {
  return (import.meta as TViteImportMeta).env?.PROD === true;
}
