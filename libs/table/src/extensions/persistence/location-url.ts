import type { IUrlPort } from './core';

/** The address bar through `history.replaceState`, for applications without a router of their own. */
export function locationUrlPort(): IUrlPort {
  return {
    read: parameter => new URL(globalThis.location.href).searchParams.get(parameter) ?? undefined,
    write: (parameter, value) => {
      const url = new URL(globalThis.location.href);
      if (value === undefined) {
        url.searchParams.delete(parameter);
      } else {
        url.searchParams.set(parameter, value);
      }
      globalThis.history.replaceState(globalThis.history.state, '', url);
    },
    hrefWith: (parameter, value) => {
      const url = new URL(globalThis.location.href);
      url.searchParams.set(parameter, value);
      return url.href;
    },
  };
}
