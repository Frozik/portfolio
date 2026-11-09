import { assertNever } from '@frozik/utils/assert/assertNever';

import { canonicalNumberPattern } from '../../masks/domain/number-mask-canonical';
import { patternRegexSource } from '../../masks/domain/pattern-regex';
import type { ICaller } from '../../phone/domain/caller';
import type { IMatchingEnvironment } from './matching-environment';
import type { TMember, TSpecialMask } from './member';

/**
 * How a member took a caller. `explicit` means the user named this person (a picked contact,
 * a mask over contact names); `pattern` means a rule that happens to cover them, which
 * «exclude my contacts» overrides.
 */
export type TMatchKind = 'explicit' | 'pattern';

type TMatcher = (caller: ICaller, environment: IMatchingEnvironment) => TMatchKind | null;

const NEVER: TMatcher = () => null;

function regexOf(source: string): RegExp {
  return new RegExp(source, 'u');
}

function specialMatcher(special: TSpecialMask): TMatcher {
  switch (special) {
    case 'hidden':
      return caller => (caller.number === null ? 'pattern' : null);
    case 'foreign':
      return (caller, environment) =>
        caller.traits?.country !== undefined &&
        caller.traits.country !== null &&
        environment.networkCountry !== null &&
        caller.traits.country !== environment.networkCountry
          ? 'pattern'
          : null;
    case 'premium-rate':
      return caller =>
        caller.traits?.type === 'premium-rate' || caller.traits?.type === 'shared-cost'
          ? 'pattern'
          : null;
    case 'voip':
      return caller => (caller.traits?.type === 'voip' ? 'pattern' : null);
    case 'toll-free':
      return caller => (caller.traits?.type === 'toll-free' ? 'pattern' : null);
    default:
      return assertNever(special);
  }
}

function compile(member: TMember, environment: IMatchingEnvironment): TMatcher {
  switch (member.kind) {
    case 'number-mask': {
      const canonical = canonicalNumberPattern(member.mask, environment.home);
      if (!canonical.ok) {
        return NEVER;
      }
      const regex = regexOf(patternRegexSource(canonical.value, 'digits'));
      return caller => (caller.number !== null && regex.test(caller.number) ? 'pattern' : null);
    }
    case 'name-mask': {
      const regex = regexOf(patternRegexSource(member.mask.pattern, 'text'));
      const contactMatches = (caller: ICaller): boolean =>
        caller.contact !== null && regex.test(caller.contact.name);
      const networkMatches = (caller: ICaller): boolean =>
        caller.networkName !== null && regex.test(caller.networkName);
      switch (member.field) {
        case 'contact':
          return caller => (contactMatches(caller) ? 'explicit' : null);
        case 'network':
          return caller => (networkMatches(caller) ? 'pattern' : null);
        case 'any':
          return caller =>
            contactMatches(caller) ? 'explicit' : networkMatches(caller) ? 'pattern' : null;
        default:
          return assertNever(member.field);
      }
    }
    case 'special':
      return specialMatcher(member.special);
    case 'contact':
      return caller =>
        (caller.number !== null && member.numbers.includes(caller.number)) ||
        (member.lookupKey !== null && caller.contact?.lookupKey === member.lookupKey)
          ? 'explicit'
          : null;
    default:
      return assertNever(member);
  }
}

interface ICompiled {
  readonly environment: IMatchingEnvironment;
  readonly matcher: TMatcher;
}

/** Members are immutable values, so a compiled regex lives as long as the member it came from. */
const COMPILED = new WeakMap<TMember, ICompiled>();

export function matchMember(
  member: TMember,
  caller: ICaller,
  environment: IMatchingEnvironment
): TMatchKind | null {
  const cached = COMPILED.get(member);
  if (cached?.environment.home === environment.home) {
    return cached.matcher(caller, environment);
  }
  const matcher = compile(member, environment);
  COMPILED.set(member, { environment, matcher });
  return matcher(caller, environment);
}

export function matchesAny(
  members: readonly TMember[],
  caller: ICaller,
  environment: IMatchingEnvironment
): boolean {
  return members.some(member => matchMember(member, caller, environment) !== null);
}
