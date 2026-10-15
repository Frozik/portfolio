import { onWorkerTakeover } from './worker-takeover';

function aContainer(controlled: boolean) {
  const target = new EventTarget();
  return Object.assign(target, { controller: controlled ? {} : null });
}

describe('a worker taking over the page', () => {
  it('marks the claim of a page that started uncontrolled, and only that one', () => {
    const container = aContainer(false);
    const takeovers: boolean[] = [];
    onWorkerTakeover(container, ({ firstClaim }) => takeovers.push(firstClaim));

    container.dispatchEvent(new Event('controllerchange'));
    container.dispatchEvent(new Event('controllerchange'));

    expect(takeovers).toEqual([true, false]);
  });

  it('treats every change of a controlled page as a new build', () => {
    const container = aContainer(true);
    const takeovers: boolean[] = [];
    onWorkerTakeover(container, ({ firstClaim }) => takeovers.push(firstClaim));

    container.dispatchEvent(new Event('controllerchange'));

    expect(takeovers).toEqual([false]);
  });
});
