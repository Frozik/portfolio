import { createHash } from 'node:crypto';

import type { Plugin } from 'vite';

/** Script URLs the Trusted Types policy lets through besides the site's own path. */
const TRUSTED_SCRIPT_PREFIXES = [
  'https://accounts.google.com/gsi/client',
  'https://static.cloudflareinsights.com/beacon.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/',
] as const;

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const HEAD_OPEN = /<head[^>]*>/;

/**
 * The `default` Trusted Types policy: a script URL passes
 * only from the build's own assets, the service worker, a `blob:` this page
 * made (a `blob:` URL is only ever minted by its own origin) or one of the
 * known services; HTML and script text have no rule, so writing them is refused.
 */
function trustedTypesScript(basePath: string): string {
  const allowed = JSON.stringify(TRUSTED_SCRIPT_PREFIXES);
  return (
    `if(window.trustedTypes&&trustedTypes.createPolicy){trustedTypes.createPolicy('default',{createScriptURL:function(u){` +
    `var url=new URL(u,location.href);var own=url.origin===location.origin&&(url.pathname.indexOf(${JSON.stringify(`${basePath}/assets/`)})===0||url.pathname===${JSON.stringify(`${basePath}/sw.js`)}||url.protocol==='blob:');` +
    `if(own||${allowed}.some(function(p){return url.href.indexOf(p)===0})){return u}` +
    `throw new TypeError('Trusted Types: script URL refused: '+u)}})}`
  );
}

function sha256Source(script: string): string {
  return `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
}

function policyOf({
  communicationUrl,
  scriptHashes,
}: {
  readonly communicationUrl: string;
  readonly scriptHashes: readonly string[];
}): string {
  const communication = new URL(communicationUrl);
  const socket = `${communication.protocol === 'https:' ? 'wss' : 'ws'}://${communication.host}`;
  return [
    "default-src 'self'",
    [
      "script-src 'self' 'wasm-unsafe-eval'",
      ...scriptHashes,
      'https://accounts.google.com/gsi/client',
      'https://static.cloudflareinsights.com/beacon.min.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/',
    ].join(' '),
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "frame-src 'self' https://accounts.google.com",
    [
      "connect-src 'self'",
      communication.origin,
      socket,
      'https://api.binance.com',
      'wss://stream.binance.com:9443',
      'https://tile.openstreetmap.org',
      'https://tiles.openfreemap.org',
      'https://login.yandex.ru',
      'https://accounts.google.com',
      'https://cloudflareinsights.com',
      'https://cdn.jsdelivr.net/npm/@mediapipe/',
      'https://storage.googleapis.com/mediapipe-models/',
      'https://www.googleapis.com/drive/v3/',
      'https://www.googleapis.com/upload/drive/v3/',
      'https://api.pwnedpasswords.com/range/',
      'https://api.2fa.directory/v4/',
      'https://icon.horse/icon/',
      'https://favicone.com/',
    ].join(' '),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
  ].join('; ');
}

/**
 * S5 — the page's CSP as a `<meta>` (GitHub Pages sets no
 * headers): first in `<head>` so it governs everything after it, then the
 * Trusted Types policy; every inline script, that one included, is allowed by
 * its hash, taken from the page as built.
 */
export function withContentSecurityPolicy(
  html: string,
  { communicationUrl, basePath }: { readonly communicationUrl: string; readonly basePath: string }
): string {
  const policyScript = `<script>${trustedTypesScript(basePath)}</script>`;
  const withPolicy = html.replace(HEAD_OPEN, opening => `${opening}${policyScript}`);
  const scriptHashes = [...withPolicy.matchAll(INLINE_SCRIPT)].map(match =>
    sha256Source(match[1] ?? '')
  );
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policyOf({ communicationUrl, scriptHashes })}">`;
  return withPolicy.replace(HEAD_OPEN, opening => `${opening}${meta}`);
}

/** Runs last on the built page, after the prerender and the service worker registration added theirs. */
export function contentSecurityPolicy(options: {
  readonly communicationUrl: string;
  readonly basePath: string;
}): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler: html => withContentSecurityPolicy(html, options),
    },
  };
}
