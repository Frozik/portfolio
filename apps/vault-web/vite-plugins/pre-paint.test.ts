import type { Document } from 'happy-dom';
import { Window } from 'happy-dom';

import { prePaintScript } from './pre-paint.ts';

const OPTIONS = {
  themeKey: 'vault:theme',
  languages: ['en', 'ru'],
  background: { light: '#ffffff', dark: '#000000' },
};

function run({
  languages = ['en-US'],
  stored = null,
  framed = false,
}: {
  readonly languages?: readonly string[];
  readonly stored?: string | null;
  readonly framed?: boolean;
} = {}): Document {
  const window = new Window({ settings: { enableJavaScriptEvaluation: true } });
  window.document.write(
    '<html><head><meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">' +
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000"></head></html>'
  );
  Object.defineProperty(window.navigator, 'languages', { value: languages });
  if (stored !== null) {
    window.localStorage.setItem(OPTIONS.themeKey, stored);
  }
  if (framed) {
    Object.defineProperty(window, 'top', { value: {} });
  }
  const script = window.document.createElement('script');
  script.textContent = prePaintScript(OPTIONS);
  window.document.head.append(script);
  return window.document;
}

function themeColors(document: Document): readonly (string | null)[] {
  return [...document.querySelectorAll('meta[name="theme-color"]')].map(meta =>
    meta.getAttribute('content')
  );
}

describe('the pre-paint script', () => {
  it('turns zod’s code generation off before any module builds a schema', () => {
    const document = run();

    expect(Reflect.get(document.defaultView ?? {}, '__zod_globalConfig')).toEqual({
      jitless: true,
    });
  });

  it('reveals the page at the top of its window', () => {
    expect(run().documentElement.classList.contains('unframed')).toBe(true);
  });

  it('keeps a framed page hidden', () => {
    expect(run({ framed: true }).documentElement.classList.contains('unframed')).toBe(false);
  });

  it('speaks the first preferred language the app knows, English otherwise', () => {
    expect(run({ languages: ['de-DE', 'ru-RU', 'en'] }).documentElement.lang).toBe('ru');
    expect(run({ languages: ['de-DE'] }).documentElement.lang).toBe('en');
  });

  it('applies the stored scheme and paints the browser chrome with it', () => {
    const document = run({ stored: 'dark' });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(themeColors(document)).toEqual(['#000000', '#000000']);
  });

  it('follows the system for no choice or one it does not know', () => {
    const document = run({ stored: 'sepia' });

    expect(document.documentElement.dataset.theme).toBe('system');
    expect(themeColors(document)).toEqual(['#ffffff', '#000000']);
  });
});
