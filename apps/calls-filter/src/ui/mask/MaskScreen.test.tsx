import { fireEvent, screen } from 'expo-router/testing-library';

import GroupRoute from '../../app/group/[id]';
import MaskRoute from '../../app/mask';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { bookOf, custom, numberMask } from '../../contexts/grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK } from '../../contexts/policy/domain/policy';
import type { IFakePhone } from '../../testing/fake-ports';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const EXACT = numberMask('+7 495 123 45 67');
const SPAM = custom('spam', [EXACT], { policy: ALWAYS_BLOCK });

function includeOf(phone: IFakePhone) {
  const saved = phone.saved();
  const group = saved === null ? null : findGroup(saved, 'spam' as TGroupId);
  return group?.kind === 'custom' ? group.include : [];
}

describe('a mask of a group, written anew', () => {
  it('opens from the member’s sheet with the mask as it is', async () => {
    const rendered = await renderApp(
      { 'group/[id]': GroupRoute, mask: MaskRoute },
      { phone: fakePhone({ book: bookOf([SPAM]) }), initialUrl: '/group/spam' }
    );
    await fireEvent.press(await screen.findByTestId('group-tab-rules'));
    await fireEvent.press(await screen.findByTestId(`member-${EXACT.id}`));
    await fireEvent.press(await screen.findByTestId('member-edit'));

    expect(rendered.getPathname()).toBe('/mask');
    expect(await screen.findByTestId('mask-source')).toHaveTextContent('+7 495 123 45 67');
  });

  it('replaces the exact number with a pattern in the same place, not beside it', async () => {
    const phone = fakePhone({ book: bookOf([SPAM]) });
    await renderApp(
      { mask: MaskRoute },
      {
        phone,
        initialUrl: `/mask?group=spam&side=include&member=${EXACT.id}`,
      }
    );
    await screen.findByTestId('mask-source');
    for (let erased = 0; erased < '123 45 67'.length; erased++) {
      await fireEvent.press(screen.getByTestId('key-erase'));
    }
    await fireEvent.press(screen.getByTestId('key-*'));
    await fireEvent.press(screen.getByTestId('mask-save'));

    expect(
      includeOf(phone).map(member => [
        member.id,
        member.kind === 'number-mask' ? member.mask.source : null,
      ])
    ).toEqual([[EXACT.id, '+7 495 *']]);
  });
});
