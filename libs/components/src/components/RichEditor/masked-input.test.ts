import {
  createMaskNormalizer,
  createMaskSegmentRenderer,
  enterMaskedText,
  MASKS,
} from './masked-input';
import type { IMaskPattern } from './masked-input';

const card: IMaskPattern = {
  accepts: character => /\d/.test(character),
  maxLength: 19,
  gaps: [4, 8, 12],
};

describe('masked input', () => {
  it('keeps what the mask accepts and moves the caret with its characters', () => {
    const normalize = createMaskNormalizer(card);

    expect(normalize('4111 1111-1111 1111', { start: 19, end: 19 })).toEqual({
      value: '4111111111111111',
      selection: { start: 16, end: 16 },
    });
    expect(normalize('41x1', { start: 3, end: 3 })).toEqual({
      value: '411',
      selection: { start: 2, end: 2 },
    });
  });

  it('upper-cases and caps the length where the mask says', () => {
    expect(enterMaskedText('de89 3704 0044 0532 0130 00', MASKS.iban)).toBe(
      'DE89370400440532013000'
    );
    expect(enterMaskedText('deutdeffxxxx', MASKS.bic)).toBe('DEUTDEFFXXX');
  });

  it('takes a plus only in front of a phone number', () => {
    expect(enterMaskedText('+1 (800) 847-2911', MASKS.phone)).toBe('+18008472911');
    expect(enterMaskedText('1+800', MASKS.phone)).toBe('1800');
  });

  it('follows a mask that changes with the value', () => {
    const byNetwork = (value: string): IMaskPattern =>
      value.startsWith('3') ? { ...card, maxLength: 15, gaps: [4, 10] } : card;

    expect(enterMaskedText('3782 822463 10005 999', byNetwork)).toBe('378282246310005');
    expect(createMaskSegmentRenderer(byNetwork, 'gap')('378282246310005', false)).toEqual([
      { text: '3782' },
      { text: '8', className: 'gap' },
      { text: '22463' },
      { text: '1', className: 'gap' },
      { text: '0005' },
    ]);
  });

  it('shows groups without putting separators into the text', () => {
    const segments = createMaskSegmentRenderer(card, 'gap')('41111111', true);

    expect(segments.map(segment => segment.text).join('')).toBe('41111111');
    expect(segments).toEqual([{ text: '4111' }, { text: '1', className: 'gap' }, { text: '111' }]);
  });
});
