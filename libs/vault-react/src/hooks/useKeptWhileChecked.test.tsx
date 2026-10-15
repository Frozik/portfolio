import { act, renderHook } from '@testing-library/react';

import { useKeptWhileChecked } from '../hooks/useKeptWhileChecked';

describe('a password kept while it is checked', () => {
  it('stays while the check runs and clears once it is refused', () => {
    const { result, rerender } = renderHook(({ checking }) => useKeptWhileChecked(checking), {
      initialProps: { checking: false },
    });
    act(() => result.current[1]('hunter2'));

    rerender({ checking: true });
    const during = result.current[0];
    rerender({ checking: false });

    expect([during, result.current[0]]).toEqual(['hunter2', '']);
  });
});
