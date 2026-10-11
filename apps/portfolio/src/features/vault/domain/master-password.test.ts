import { masterPasswordProblem } from './master-password';

const LONG = 'correct horse battery';

describe('masterPasswordProblem', () => {
  it('asks for twelve characters and nothing about their kind', () => {
    expect(
      masterPasswordProblem({ password: 'short', confirmation: 'short', acknowledged: true })
    ).toBe('too-short');
    expect(
      masterPasswordProblem({
        password: 'aaaaaaaaaaaa',
        confirmation: 'aaaaaaaaaaaa',
        acknowledged: true,
      })
    ).toBeNull();
  });

  it('counts an emoji as one character, not two', () => {
    const elevenAndEmoji = 'abcdefghijk😀';

    expect(
      masterPasswordProblem({
        password: elevenAndEmoji,
        confirmation: elevenAndEmoji,
        acknowledged: true,
      })
    ).toBeNull();
    expect(
      masterPasswordProblem({
        password: 'abcdefghij😀',
        confirmation: 'abcdefghij😀',
        acknowledged: true,
      })
    ).toBe('too-short');
  });

  it('wants the same password twice and the "no recovery" box ticked', () => {
    expect(
      masterPasswordProblem({ password: LONG, confirmation: `${LONG}!`, acknowledged: true })
    ).toBe('mismatch');
    expect(masterPasswordProblem({ password: LONG, confirmation: LONG, acknowledged: false })).toBe(
      'not-acknowledged'
    );
  });
});
