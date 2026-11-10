import type { ICaller } from '../../phone/domain/caller';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import {
  bookOf,
  contact,
  custom,
  MY_CONTACTS_ID,
  nameMask,
  NETHERLANDS_HOME,
  numberMask,
  pickedContact,
  special,
  stranger,
  STRANGERS_ID,
} from '../testing/group-book-fixtures';
import type { GroupBook } from './group-book';
import { membership } from './membership';

function groupOf(book: GroupBook, caller: ICaller): string {
  const found = membership(book, caller, NETHERLANDS_HOME);
  return found.kind === 'one'
    ? found.group.id
    : `conflict:${found.groups.map(group => group.id).join(',')}`;
}

describe('the group of a caller', () => {
  it('is the group whose mask takes the number', () => {
    const book = bookOf([custom('spam', [numberMask('+7 495*')])]);
    expect(groupOf(book, stranger('74951234567'))).toBe('spam');
  });

  it('reads a national mask the way the home country dials', () => {
    const book = bookOf([custom('delivery', [numberMask('085 *')])]);
    expect(groupOf(book, stranger('31851234567'))).toBe('delivery');
  });

  it('falls to «strangers» when no group takes the caller by number or by name', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*'), nameMask('*klantenservice*', 'network')]),
    ]);
    expect(groupOf(book, stranger('31201234567', 'PostNL'))).toBe(STRANGERS_ID);
  });

  it('takes a caller by the operator name as well as by the number', () => {
    const book = bookOf([custom('spam', [nameMask('*klantenservice*', 'network')])]);
    expect(groupOf(book, stranger('31201234567', 'KPN Klantenservice'))).toBe('spam');
  });

  it('takes a caller by a name with a dash and a colon in it, read as plain characters', () => {
    const book = bookOf([custom('spam', [nameMask('IP Isanshin: kol-tsentr', 'network')])]);
    expect(groupOf(book, stranger('79864563560', 'IP Isanshin: kol-tsentr'))).toBe('spam');
  });

  it('keeps an exclusion stronger than the inclusion', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')], { exclude: [numberMask('+7 495 123 45 67')] }),
    ]);
    expect(groupOf(book, stranger('74951234567'))).toBe(STRANGERS_ID);
  });

  it('puts the address book in «my contacts»', () => {
    expect(groupOf(bookOf([]), contact('Mum', '31612345678'))).toBe(MY_CONTACTS_ID);
  });

  it('lets «exclude my contacts» keep contacts out of a pattern', () => {
    const work = (excludeMyContacts: boolean) =>
      bookOf(
        [custom('work', [numberMask('+31 20 555 ....')], { excludeMyContacts })],
        [numberMask('+31 20 555 ....')]
      );
    expect(groupOf(work(true), contact('Colleague', '31205551234'))).toBe(STRANGERS_ID);
    expect(groupOf(work(false), contact('Colleague', '31205551234'))).toBe('work');
  });

  it('never lets the switch drop a contact picked by hand', () => {
    const mum = pickedContact('Mum', '31612345678');
    const book = bookOf(
      [custom('family', [mum], { excludeMyContacts: true })],
      [{ ...mum, id: 'exclusion' as never }]
    );
    expect(groupOf(book, contact('Mum', '31612345678'))).toBe('family');
  });

  it('treats a mask over contact names as naming those contacts', () => {
    const book = bookOf(
      [custom('couriers', [nameMask('courier*', 'contact')])],
      [nameMask('courier*', 'contact')]
    );
    expect(groupOf(book, contact('Courier Ozon', '31612345000'))).toBe('couriers');
  });

  it('sends an excluded contact nobody took to «strangers»', () => {
    const book = bookOf([], [pickedContact('Ex', '31600000000')]);
    expect(groupOf(book, contact('Ex', '31600000000'))).toBe(STRANGERS_ID);
  });

  it('knows hidden, foreign and premium numbers without masks', () => {
    const book = bookOf([
      custom('hidden', [special('hidden')]),
      custom('abroad', [special('foreign')]),
      custom('paid', [special('premium-rate')]),
    ]);
    expect(groupOf(book, { number: null, traits: null, networkName: null, contact: null })).toBe(
      'hidden'
    );
    expect(
      groupOf(book, {
        ...stranger('4420794600'),
        traits: { country: 'GB' as TCountryCode, type: 'fixed-line' },
      })
    ).toBe('abroad');
    expect(
      groupOf(book, {
        ...stranger('319001234'),
        traits: { country: 'NL' as TCountryCode, type: 'premium-rate' },
      })
    ).toBe('paid');
  });

  it('calls a caller two groups take a conflict', () => {
    const book = bookOf([
      custom('spam', [numberMask('+7 495*')]),
      custom('delivery', [numberMask('+7 495 1*')]),
    ]);
    expect(groupOf(book, stranger('74951000000'))).toBe('conflict:spam,delivery');
  });
});
