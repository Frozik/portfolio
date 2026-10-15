import { createHash } from 'node:crypto';

import type { Plugin } from 'vite';

/** The hashes of the page's inline scripts and styles, as CSP sources. */
export interface IInlineHashes {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
}

export interface IContentSecurityPolicyOptions {
  /** The site's path (`/portfolio`, or `''` at the root): its assets and service worker are the page's own scripts. */
  readonly basePath: string;
  /** Script URLs the Trusted Types policy lets through besides the site's own. */
  readonly trustedScriptPrefixes: readonly string[];
  /** The directives, given the hashes of everything inline on the built page. */
  readonly policy: (hashes: IInlineHashes) => readonly string[];
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const INLINE_STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;
/** The head's opening, with the charset declaration that must stay within the first 1024 bytes. */
const HEAD_OPEN = /<head[^>]*>(\s*<meta charset[^>]*>)?/;

/**
 * The `default` Trusted Types policy: a script URL passes
 * only from the build's own assets, the service worker, a `blob:` this page
 * made (a `blob:` URL is only ever minted by its own origin) or one of the
 * known services; HTML and script text have no rule, so writing them is refused.
 */
function trustedTypesScript(basePath: string, trustedScriptPrefixes: readonly string[]): string {
  const allowed = JSON.stringify(trustedScriptPrefixes);
  return (
    `if(window.trustedTypes&&trustedTypes.createPolicy){trustedTypes.createPolicy('default',{createScriptURL:function(u){` +
    `var url=new URL(u,location.href);var own=url.origin===location.origin&&(url.pathname.indexOf(${JSON.stringify(`${basePath}/assets/`)})===0||url.pathname===${JSON.stringify(`${basePath}/sw.js`)}||url.protocol==='blob:');` +
    `if(own||${allowed}.some(function(p){return url.href.indexOf(p)===0})){return u}` +
    `throw new TypeError('Trusted Types: script URL refused: '+u)}})}`
  );
}

function sha256Source(text: string): string {
  return `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
}

function hashesOf(html: string, pattern: RegExp): readonly string[] {
  return [...html.matchAll(pattern)].map(match => sha256Source(match[1] ?? ''));
}

/**
 * The page's CSP as a `<meta>` (GitHub Pages sets no headers): first in
 * `<head>` so it governs everything after it, then the Trusted Types policy;
 * the policy sees the hash of every inline script and style, taken from the
 * page as built, that one included.
 */
export function withContentSecurityPolicy(
  html: string,
  { basePath, trustedScriptPrefixes, policy }: IContentSecurityPolicyOptions
): string {
  const policyScript = `<script>${trustedTypesScript(basePath, trustedScriptPrefixes)}</script>`;
  const withPolicy = html.replace(HEAD_OPEN, opening => `${opening}${policyScript}`);
  const directives = policy({
    scripts: hashesOf(withPolicy, INLINE_SCRIPT),
    styles: hashesOf(withPolicy, INLINE_STYLE),
  });
  const meta = `<meta http-equiv="Content-Security-Policy" content="${directives.join('; ')}">`;
  return withPolicy.replace(HEAD_OPEN, opening => `${opening}${meta}`);
}

/** Runs last on the built page, after every plugin that adds inline markup. */
export function contentSecurityPolicy(options: IContentSecurityPolicyOptions): Plugin {
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
