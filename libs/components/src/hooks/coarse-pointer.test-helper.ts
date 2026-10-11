const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** A finger as the primary pointer, for the touch branches of the controls; undo with `vi.restoreAllMocks()`. */
export function pretendCoarsePointer(): void {
  const matchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    const list = matchMedia(query);
    // happy-dom's list keeps private fields, so its methods only run bound to the real object.
    return new Proxy(list, {
      get: (target, key) => {
        if (key === 'matches' && query === COARSE_POINTER_QUERY) {
          return true;
        }
        const member: unknown = Reflect.get(target, key, target);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
  });
}
