import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';

import { combineOutcomes } from '../domain/fill-outcome';
import type { IFrameFacts } from '../domain/frame-verdict';
import { frameVerdict } from '../domain/frame-verdict';
import type { TFillOutcome } from '../domain/messages';
import type { IFillRequest, IPageFiller } from '../domain/ports';

/** The name the fill script gives itself in the page's isolated world. */
export const FILL_GLOBAL = '__pwvFill';
const FILL_SCRIPT = '/fill.js';
const OUTCOMES: ReadonlySet<string> = new Set<TFillOutcome>([
  'filled',
  'no-form',
  'other-site',
  'insecure-page',
  'not-allowed',
  'locked',
]);

function isOutcome(value: unknown): value is TFillOutcome {
  return typeof value === 'string' && OUTCOMES.has(value);
}

function isFrameFacts(value: unknown): value is IFrameFacts {
  return (
    typeof value === 'object' &&
    !isNil(value) &&
    typeof Reflect.get(value, 'url') === 'string' &&
    typeof Reflect.get(value, 'topIsSecure') === 'boolean'
  );
}

/** Runs in each frame, alone (no imports): its address and whether the tab's top page is HTTPS. */
function describeFrame(): IFrameFacts {
  const ancestors = location.ancestorOrigins;
  const top = ancestors.length > 0 ? ancestors.item(ancestors.length - 1) : location.origin;
  return { url: location.href, topIsSecure: top?.startsWith('https:') ?? false };
}

/**
 * Two steps: every frame first says where it is, with
 * nothing secret sent; only the frames the card is for get the values, by
 * their document (a frame that navigated meanwhile is another document), and
 * each checks itself once more. Chrome's own pages refuse the injection.
 */
export const CHROME_PAGE_FILLER: IPageFiller = {
  async fill(tabId, request) {
    try {
      const frames = await browser.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: describeFrame,
      });
      const verdicts = frames.flatMap(frame =>
        isFrameFacts(frame.result) ? [{ frame, verdict: frameVerdict(request, frame.result) }] : []
      );
      const documentIds = verdicts.flatMap(({ frame, verdict }) =>
        verdict === 'fill' && !isNil(frame.documentId) ? [frame.documentId] : []
      );
      if (documentIds.length === 0) {
        return combineOutcomes(
          verdicts.map(({ verdict }) => (verdict === 'fill' ? 'no-form' : verdict))
        );
      }
      const target = { tabId, documentIds };
      await browser.scripting.executeScript({ target, files: [FILL_SCRIPT] });
      const filled = await browser.scripting.executeScript({
        target,
        func: (name: string, fillRequest: IFillRequest) => {
          const fill: unknown = Reflect.get(globalThis, name);
          return typeof fill === 'function' ? fill(fillRequest) : 'no-form';
        },
        args: [FILL_GLOBAL, request],
      });
      return combineOutcomes(filled.map(frame => frame.result).filter(isOutcome));
    } catch {
      return 'not-allowed';
    }
  },
};
