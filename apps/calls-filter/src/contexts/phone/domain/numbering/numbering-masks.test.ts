import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseNumberMask } from '../../../masks/domain/number-mask';
import type { TE164Digits } from '../caller';
import type { INumberingMask } from './gen/numbering-codes';
import { numberingOf } from './numbering-lookup';

const ROOTS: readonly INumberingMask[] = JSON.parse(
  readFileSync(join(__dirname, 'gen', 'numbering-masks.json'), 'utf8')
);

function everyNode(nodes: readonly INumberingMask[]): readonly INumberingMask[] {
  return nodes.flatMap(node => [node, ...everyNode(node.children ?? [])]);
}

const NODES = everyNode(ROOTS);

function digitsOf(node: INumberingMask): string {
  return node.mask.slice(1, -1);
}

function catalogueEntryOf(digits: string): INumberingMask | null {
  return numberingOf(ROOTS, digits as TE164Digits);
}

describe('the numbering catalogue', () => {
  it('is written in the number mask syntax, international prefixes only', () => {
    const invalid = NODES.filter(
      node => !parseNumberMask(node.mask).ok || !/^\+\d+\*$/.test(node.mask)
    );
    expect(invalid.map(node => node.mask)).toEqual([]);
  });

  it('lists every mask once', () => {
    const masks = NODES.map(node => node.mask);
    expect(new Set(masks).size).toBe(masks.length);
  });

  it('nests every mask inside its parent, and no two siblings overlap', () => {
    const misplaced = NODES.flatMap(parent =>
      (parent.children ?? [])
        .filter(child => !digitsOf(child).startsWith(digitsOf(parent)))
        .map(child => `${child.mask} under ${parent.mask}`)
    );
    const overlapping = [ROOTS, ...NODES.map(node => node.children ?? [])].flatMap(siblings =>
      siblings.flatMap(node =>
        siblings
          .filter(other => other !== node && digitsOf(other).startsWith(digitsOf(node)))
          .map(other => `${other.mask} beside ${node.mask}`)
      )
    );
    expect([...misplaced, ...overlapping]).toEqual([]);
  });

  it('tells a number by its deepest mask: the network and the region it was given to', () => {
    expect(catalogueEntryOf('79630001234')).toEqual({
      mask: '+7963000*',
      countryCode: 'RU',
      networkOperatorCode: 'beeline',
      stateCodes: ['kirov-oblast'],
    });
    expect(catalogueEntryOf('79161234567')).toMatchObject({
      networkOperatorCode: 'mts',
      stateCodes: ['moscow', 'moscow-oblast'],
    });
    expect(catalogueEntryOf('78123456789')).toMatchObject({ stateCodes: ['saint-petersburg'] });
  });

  it('stops at the parent when no narrower mask covers the number', () => {
    expect(catalogueEntryOf('12015550123')).toMatchObject({
      mask: '+1201*',
      stateCodes: ['new-jersey'],
    });
    expect(catalogueEntryOf('31612345678')).toMatchObject({ mask: '+31*', countryCode: 'NL' });
  });

  it('tells countries that share a calling code apart', () => {
    expect(catalogueEntryOf('77011234567')?.countryCode).toBe('KZ');
    expect(catalogueEntryOf('74951234567')?.countryCode).toBe('RU');
    expect(catalogueEntryOf('12685551234')?.countryCode).toBe('AG');
    expect(catalogueEntryOf('12125550123')).toMatchObject({
      countryCode: 'US',
      stateCodes: ['new-york'],
    });
    expect(catalogueEntryOf('35818123456')?.countryCode).toBe('AX');
  });

  it('knows the services that belong to no country', () => {
    expect(catalogueEntryOf('88161234567')).toEqual({
      mask: '+8816*',
      networkOperatorCode: 'iridium',
      serviceCode: 'global-mobile-satellite',
    });
  });
});
