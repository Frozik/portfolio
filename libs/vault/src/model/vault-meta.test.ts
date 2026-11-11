import { EMPTY_VAULT_META, mergeVaultMeta, withStrengthScores } from './vault-meta';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

describe("the vault's own cache", () => {
  it('keeps the scores of the passwords the vault holds, under the meter that gave them', () => {
    const meta = withStrengthScores(
      EMPTY_VAULT_META,
      'zxcvbn:ru:2',
      new Map([
        [A, 1],
        [B, 4],
      ]),
      new Set([A, B])
    );

    expect(meta.strength).toEqual(
      new Map([
        [
          'zxcvbn:ru:2',
          new Map([
            [A, 1],
            [B, 4],
          ]),
        ],
      ])
    );
  });

  it('forgets the scores of passwords gone from every card, in every meter’s section', () => {
    const before = mergeVaultMeta(
      withStrengthScores(
        EMPTY_VAULT_META,
        'zxcvbn:ru:2',
        new Map([
          [A, 1],
          [B, 4],
        ]),
        new Set([A, B])
      ),
      withStrengthScores(EMPTY_VAULT_META, 'zxcvbn:en:2', new Map([[B, 3]]), new Set([B]))
    );

    const after = withStrengthScores(before, 'zxcvbn:ru:2', new Map([[C, 2]]), new Set([A, C]));

    expect(after.strength).toEqual(
      new Map([
        [
          'zxcvbn:ru:2',
          new Map([
            [A, 1],
            [C, 2],
          ]),
        ],
      ])
    );
  });

  it('brings two devices’ scores together without losing either', () => {
    const phone = withStrengthScores(
      EMPTY_VAULT_META,
      'zxcvbn:ru:2',
      new Map([[A, 1]]),
      new Set([A])
    );
    const browser = mergeVaultMeta(
      withStrengthScores(EMPTY_VAULT_META, 'zxcvbn:ru:2', new Map([[B, 4]]), new Set([B])),
      withStrengthScores(EMPTY_VAULT_META, 'zxcvbn:en:2', new Map([[B, 3]]), new Set([B]))
    );

    expect(mergeVaultMeta(phone, browser).strength).toEqual(
      new Map([
        [
          'zxcvbn:ru:2',
          new Map([
            [B, 4],
            [A, 1],
          ]),
        ],
        ['zxcvbn:en:2', new Map([[B, 3]])],
      ])
    );
  });
});
