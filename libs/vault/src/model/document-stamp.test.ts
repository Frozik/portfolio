import { aCard, aDocument, anHlc } from '../testing/builders';
import { latestStampOf } from './document-stamp';
import type { IHlc } from './hlc';
import type { TCardId } from './ids';
import type { TTombstoneKey } from './vault-document';

describe('latestStampOf', () => {
  it('finds the latest stamp wherever it sits: a card, a deletion or the settings', () => {
    const edited = aCard({ updatedAt: anHlc(5) });

    expect(latestStampOf(aDocument([edited]))).toEqual(anHlc(5));
    expect(
      latestStampOf(
        aDocument([edited], {
          tombstones: new Map<TTombstoneKey, IHlc>([
            [`card:${'gone' as TCardId}`, anHlc(9, 'device-b:1')],
          ]),
        })
      )
    ).toEqual(anHlc(9, 'device-b:1'));
    expect(latestStampOf(aDocument())).toEqual(anHlc(1));
  });
});
