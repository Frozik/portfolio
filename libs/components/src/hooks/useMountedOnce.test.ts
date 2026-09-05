import { renderHook } from '@testing-library/react';

import { useMountedOnce } from './useMountedOnce';

describe('useMountedOnce', () => {
  it('stays false until activated for the first time', () => {
    const { result, rerender } = renderHook(({ active }) => useMountedOnce(active), {
      initialProps: { active: false },
    });
    expect(result.current).toBe(false);

    rerender({ active: true });
    expect(result.current).toBe(true);
  });

  it('remains true after deactivation', () => {
    const { result, rerender } = renderHook(({ active }) => useMountedOnce(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    expect(result.current).toBe(true);
  });
});
