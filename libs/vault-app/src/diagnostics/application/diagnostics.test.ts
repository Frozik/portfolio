import { aCard } from '@frozik/vault/testing/builders';
import { when } from 'mobx';

import { aDevice, linkedToWebDav, TEST_FOLDER, TEST_PASSWORD } from '../../testing/fake-device';
import { diagnosticsLine } from '../domain/diagnostics-text';
import { DiagnosticsModel } from './DiagnosticsModel';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEADER = { app: 'Ciphra Vault v1.0.0', platform: 'Android 16 · Pixel' };

function logOf(device: ReturnType<typeof aDevice>): string {
  return device.diagnostics.entries().map(diagnosticsLine).join('\n');
}

describe('the diagnostics log', () => {
  it('keeps what happened to a vault, never its name, password or cards', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Grandma’s savings', TEST_PASSWORD);
    await when(() => first.session !== null);
    first.session?.apply(document => {
      const card = aCard({ title: 'Swiss account' });
      return { ...document, cards: new Map([...document.cards, [card.id, card]]) };
    });
    const vaultKey = first.session?.vaultKey ?? '';
    first.dispose();
    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock('hunter2 typo');
    await when(() => second.lifecycle.kind === 'locked' && second.lifecycle.failure !== null);

    const log = logOf(device);

    expect(
      device.diagnostics
        .entries()
        .filter(entry => entry.category === 'unlock' && entry.event === 'failed')
        .map(({ level, fields }) => ({ level, fields }))
    ).toEqual([{ level: 'warn', fields: { failure: 'wrong-password' } }]);
    expect(
      ['Grandma', 'Swiss', TEST_PASSWORD, 'hunter2', vaultKey].filter(secret =>
        log.includes(secret)
      )
    ).toEqual([]);
  });

  it('keeps what the cloud sync wrote, without the folder it writes to', async () => {
    const { device } = await linkedToWebDav();

    const cloud = device.diagnostics
      .entries()
      .filter(entry => entry.category === 'sync' && entry.fields['replica'] === 'cloud');

    expect(cloud.map(entry => entry.event)).toContain('written');
    expect(logOf(device)).not.toContain(new URL(TEST_FOLDER).host);
  });

  it('shows only the problems or one category, and copies what it shows', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', TEST_PASSWORD);
    await when(() => first.session !== null);
    const vaultKey = first.session?.vaultKey ?? '';
    first.dispose();
    const second = device.startStore();
    second.choose(vaultKey);
    second.unlock('typo');
    await when(() => second.lifecycle.kind === 'locked' && second.lifecycle.failure !== null);
    const diagnostics = new DiagnosticsModel(device.diagnostics, device.time.clock);

    diagnostics?.refresh();
    diagnostics?.setFilter({ kind: 'problems' });
    const problems = diagnostics?.shown.map(entry => entry.event);
    diagnostics?.setFilter({ kind: 'category', category: 'app' });
    const apps = diagnostics?.shown.map(entry => entry.category);
    const copied = diagnostics?.copyText(HEADER).split('\n') ?? [];

    expect({ problems, apps: [...new Set(apps)], categories: diagnostics?.categories }).toEqual({
      problems: ['failed'],
      apps: ['app'],
      categories: ['app', 'unlock'],
    });
    expect(copied.slice(0, 2)).toEqual([
      expect.stringMatching(/^Ciphra Vault v1\.0\.0 diagnostics /),
      HEADER.platform,
    ]);
    expect(copied.filter(line => / (INFO|WARN|ERROR) app /.test(line))).toHaveLength(
      apps?.length ?? -1
    );
  });

  it('forgets entries past the term, at once when the term gets shorter and at the next start', async () => {
    const device = aDevice();
    const first = device.startStore();
    first.create('Home', TEST_PASSWORD);
    await when(() => first.session !== null);
    const written = device.diagnostics.entries().length;
    first.dispose();

    device.time.advance(2 * DAY_MS);
    new DiagnosticsModel(device.diagnostics, device.time.clock).setTerm(1);
    const afterShortening = device.diagnostics.entries().length;
    const third = new DiagnosticsModel(device.diagnostics, device.time.clock);
    third.setTerm(30);
    device.time.advance(31 * DAY_MS);
    new DiagnosticsModel(device.diagnostics, device.time.clock);

    expect({
      written: written > 0,
      afterShortening,
      term: third.term,
      left: device.diagnostics.entries().length,
    }).toEqual({
      written: true,
      afterShortening: 0,
      term: 30,
      left: 0,
    });
  });
});
