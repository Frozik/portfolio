import { z } from 'zod';

const USER_AGENT_DATA_SCHEMA = z.object({
  mobile: z.boolean(),
  brands: z.array(z.object({ brand: z.string() })),
});

/**
 * Chrome, Edge, Brave, Opera… on a computer: the browsers that take Chrome
 * extensions. Only Chromium reports `navigator.userAgentData`, so Firefox and
 * Safari, which have no such field, never count.
 */
export function isDesktopChromium(navigatorLike: object = navigator): boolean {
  const parsed = USER_AGENT_DATA_SCHEMA.safeParse(Reflect.get(navigatorLike, 'userAgentData'));
  return (
    parsed.success &&
    !parsed.data.mobile &&
    parsed.data.brands.some(({ brand }) => brand === 'Chromium')
  );
}
