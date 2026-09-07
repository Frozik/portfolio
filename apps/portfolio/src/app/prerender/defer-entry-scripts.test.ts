import { describe, expect, it } from 'vitest';

import { deferEntryScripts } from './defer-entry-scripts';

const HTML = `<head>
    <script type="module" crossorigin src="/portfolio/assets/e-1.js"></script>
    <link rel="modulepreload" crossorigin href="/portfolio/assets/c-1.js">
    <link rel="modulepreload" crossorigin href="/portfolio/assets/c-2.js">
    <link rel="stylesheet" crossorigin href="/portfolio/assets/a-1.css">
  </head><body><div id="root"></div></body>`;

describe('deferEntryScripts', () => {
  it('moves the entry and its preloads into a bootstrap that waits for the first paint', () => {
    const html = deferEntryScripts(HTML);

    expect(html).not.toContain('<script type="module"');
    expect(html).not.toContain('<link rel="modulepreload"');
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/portfolio/assets/a-1.css">');
    expect(html).toContain('new PerformanceObserver(go).observe({type:"paint",buffered:true})');
    expect(html).toContain('if(document.hidden||!("PerformanceObserver" in window)){go();return}');
    expect(html).toContain('setTimeout(go,3000)');
    expect(html).toContain('["/portfolio/assets/c-1.js","/portfolio/assets/c-2.js"]');
    expect(html).toContain('s.src="/portfolio/assets/e-1.js"');
    expect(html.indexOf('PerformanceObserver')).toBeGreaterThan(html.indexOf('id="root"'));
  });

  it('refuses a page without a module entry', () => {
    expect(() => deferEntryScripts('<head></head><body></body>')).toThrow(/entry script/);
  });
});
