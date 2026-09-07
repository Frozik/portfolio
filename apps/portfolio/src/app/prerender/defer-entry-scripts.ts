const MODULE_SCRIPT_PATTERN = /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/;
const MODULE_PRELOAD_PATTERN = /<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g;
const BODY_END = '</body>';
/** Longest the scripts wait for a paint entry before loading anyway. */
const PAINT_TIMEOUT_MS = 3000;

/**
 * Takes the entry script and its module preloads out of the head and starts
 * them from an inline script once the first contentful paint is reported. The
 * prerendered markup is already on screen by then, so the visitor loses
 * nothing; on a slow network the CSS no longer shares its bandwidth with
 * 150 KB of JavaScript before the first paint.
 */
export function deferEntryScripts(html: string): string {
  const entry = html.match(MODULE_SCRIPT_PATTERN);
  if (entry === null) {
    throw new Error('deferEntryScripts: the module entry script was not found in index.html');
  }
  const preloads = [...html.matchAll(MODULE_PRELOAD_PATTERN)].map(match => match[1]);
  const stripped = html.replace(MODULE_SCRIPT_PATTERN, '').replace(MODULE_PRELOAD_PATTERN, '');
  // The paint entry is recorded once the first contentful frame is on screen;
  // a hidden tab paints nothing and gets the scripts at once, and the timer
  // covers a browser that never reports the entry.
  const bootstrap =
    `<script>(function(){var done=false;function go(){if(done){return}done=true;` +
    `var h=document.head;` +
    `${JSON.stringify(preloads)}.forEach(function(u){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="anonymous";l.href=u;h.appendChild(l)});` +
    `var s=document.createElement("script");s.type="module";s.crossOrigin="anonymous";s.src=${JSON.stringify(entry[1])};h.appendChild(s)}` +
    `if(document.hidden||!("PerformanceObserver" in window)){go();return}` +
    `try{new PerformanceObserver(go).observe({type:"paint",buffered:true})}catch(e){go();return}` +
    `setTimeout(go,${PAINT_TIMEOUT_MS})})()</script>`;
  const bodyEnd = stripped.lastIndexOf(BODY_END);
  if (bodyEnd === -1) {
    throw new Error('deferEntryScripts: no </body> in index.html');
  }
  return `${stripped.slice(0, bodyEnd)}${bootstrap}\n${stripped.slice(bodyEnd)}`;
}
