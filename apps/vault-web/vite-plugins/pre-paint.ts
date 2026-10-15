import type { Plugin } from 'vite';

export interface IPrePaintOptions {
  /** The `localStorage` key of the theme choice. */
  readonly themeKey: string;
  /** The languages the app speaks, the default first. */
  readonly languages: readonly string[];
  /** The page background per scheme, for the browser's own chrome. */
  readonly background: { readonly light: string; readonly dark: string };
}

/** Until the script below says the page is not framed, nothing shows: a blocked script fails safe. */
const ANTI_FRAMING_STYLE = 'html:not(.unframed){display:none}';

/**
 * Runs before the first paint and before any module, after the `theme-color`
 * metas: reveals the page only at the top of its window (Pages sends no
 * `frame-ancestors`), sets `lang` from the browser's preferred languages and
 * `data-theme` from the stored choice, and points both `theme-color` metas at
 * the chosen scheme. Site data may be blocked; the choice then reads `system`.
 * It also turns zod's code generation off through the global zod reads its
 * settings from: the CSP refuses `Function`, and zod probes for it while a
 * module builds a schema — in whichever chunk loads first.
 */
export function prePaintScript({ themeKey, languages, background }: IPrePaintOptions): string {
  return (
    `(function(){window.__zod_globalConfig=Object.assign(window.__zod_globalConfig||{},{jitless:true});` +
    `var root=document.documentElement;` +
    `if(window.top===window.self){root.classList.add('unframed')}` +
    `var spoken=${JSON.stringify(languages)};var lang=spoken[0];` +
    `var wanted=navigator.languages||[navigator.language];` +
    `for(var i=0;i<wanted.length;i++){var primary=String(wanted[i]).split('-')[0].toLowerCase();if(spoken.indexOf(primary)!==-1){lang=primary;break}}` +
    `root.lang=lang;var preference='system';` +
    `try{var stored=localStorage.getItem(${JSON.stringify(themeKey)});if(stored==='light'||stored==='dark'){preference=stored}}` +
    `catch(blocked){preference='system'}` +
    `root.setAttribute('data-theme',preference);` +
    `if(preference!=='system'){var color=preference==='dark'?${JSON.stringify(background.dark)}:${JSON.stringify(background.light)};` +
    `var metas=document.querySelectorAll('meta[name="theme-color"]');for(var m=0;m<metas.length;m++){metas[m].setAttribute('content',color)}}})()`
  );
}

function themeColorMetas({ light, dark }: IPrePaintOptions['background']): string {
  return (
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${light}">` +
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${dark}">`
  );
}

/**
 * The browser chrome's colours, the anti-framing style and the pre-paint
 * script, last in `<head>`, before the CSP plugin hashes them.
 */
export function prePaint(options: IPrePaintOptions): Plugin {
  return {
    name: 'pre-paint',
    transformIndexHtml: {
      order: 'pre',
      handler: html =>
        html.replace(
          '</head>',
          `${themeColorMetas(options.background)}<style>${ANTI_FRAMING_STYLE}</style>` +
            `<script>${prePaintScript(options)}</script></head>`
        ),
    },
  };
}
