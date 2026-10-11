import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { when } from 'mobx';

import type { ICardView } from '../domain/card-views';
import type { TRequest, TResponseOf } from '../domain/messages';
import type { TAskWorker } from '../domain/ports';
import { PopupModel } from './PopupModel';

const CARD: ICardView = {
  id: 'card-1' as TCardId,
  title: 'GitHub',
  protected: false,
  fields: [
    { id: 'f-1' as TFieldId, label: 'Login', kind: 'login', sensitive: false, value: 'jane' },
  ],
};

const SUMMARY = { id: CARD.id, title: CARD.title, login: 'jane', shared: false, protected: false };

/** A worker that answers as told and records what it was asked. */
function aWorker(answers: { readonly fill: readonly string[] }) {
  const asked: TRequest[] = [];
  const fills = [...answers.fill];
  const answerTo = (request: TRequest): unknown => {
    switch (request.kind) {
      case 'status':
        return { kind: 'unlocked', vaultName: 'Family' };
      case 'page-cards':
        return [SUMMARY];
      case 'card':
        return CARD;
      case 'fill':
        return fills.shift() ?? 'filled';
      case 'sync':
        return 'unchanged';
      default:
        return null;
    }
  };
  const ask = ((request: TRequest) => {
    asked.push(request);
    return Promise.resolve(answerTo(request) as TResponseOf<typeof request>);
  }) as TAskWorker;
  return { ask, asked };
}

describe('the popup', () => {
  it('opens the page’s only card at once and fills it, closing itself after', async () => {
    const worker = aWorker({ fill: ['filled'] });
    let closed = false;
    const model = new PopupModel(
      worker.ask,
      () => Promise.resolve({ id: 3, url: 'https://github.com/login' }),
      () => Promise.resolve(true),
      () => {
        closed = true;
      }
    );

    await model.start();
    await when(() => model.opened !== null);
    await model.fill();

    expect(model.host).toEqual({ unicode: 'github.com', punycode: null });
    expect(worker.asked.at(-1)).toEqual({
      kind: 'fill',
      cardId: CARD.id,
      tabId: 3,
      pageUrl: 'https://github.com/login',
      allowInsecure: false,
    });
    expect(closed).toBe(true);
  });

  it('asks before filling a plain-HTTP page, and fills only after the yes', async () => {
    const worker = aWorker({ fill: ['insecure-page', 'filled'] });
    const model = new PopupModel(
      worker.ask,
      () => Promise.resolve({ id: 3, url: 'http://router.local/' }),
      () => Promise.resolve(true),
      () => undefined
    );
    await model.start();
    await when(() => model.opened !== null);

    await model.fill();
    expect(model.confirmingInsecure).toBe(true);
    await model.fill(true);

    expect(
      worker.asked
        .filter(request => request.kind === 'fill')
        .map(request => 'allowInsecure' in request && request.allowInsecure)
    ).toEqual([false, true]);
  });
});
