import type { TResult } from '@frozik/utils/result/result';
import { action, computed, makeObservable, observable } from 'mobx';

import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { INumberMaskMember, TMemberId } from '../../grouping/domain/member';
import { matchMember } from '../../grouping/domain/member-matching';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import type { TMaskToken } from '../domain/mask-description';
import { describePattern, exampleOf } from '../domain/mask-description';
import type { TMaskError } from '../domain/mask-error';
import type { NumberMask } from '../domain/number-mask';
import { parseNumberMask } from '../domain/number-mask';
import type { TCanonicalError } from '../domain/number-mask-canonical';
import { canonicalNumberPattern } from '../domain/number-mask-canonical';
import type { TPattern } from '../domain/pattern';

/** Where the editor starts: a new mask (empty, or a call's number), or one of a group to rewrite. */
export type TMaskStart =
  | { readonly kind: 'new'; readonly seed: string }
  | { readonly kind: 'rewrite'; readonly member: INumberMaskMember };

/** What the editor shows under the field: why it does not parse yet, or what it means. */
export type TMaskState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly errors: readonly TMaskError[] }
  | { readonly kind: 'not-here'; readonly error: TCanonicalError }
  | {
      readonly kind: 'valid';
      readonly tokens: readonly TMaskToken[];
      readonly international: boolean;
      readonly example: string;
      readonly takesEveryone: boolean;
    };

const NUMBER_FILLER = '0';

interface IEditorPorts {
  readonly environment: () => IMatchingEnvironment;
  readonly numbering: IPhoneNumbering;
  readonly knownCallers: () => readonly ICaller[];
  readonly newMemberId: () => TMemberId;
  readonly now: () => INumberMaskMember['updatedAt'];
}

function isEveryone(pattern: TPattern): boolean {
  const [only, ...rest] = pattern;
  return rest.length === 0 && only?.symbol.kind === 'any' && only.min === 0 && only.max === null;
}

/** The mask being typed: parsed on every keystroke, explained, and tried against a number. */
export class MaskEditor {
  source: string;
  sample = '';

  constructor(
    private readonly ports: IEditorPorts,
    private readonly start: TMaskStart
  ) {
    this.source = start.kind === 'new' ? start.seed : start.member.mask.source;
    makeObservable(this, {
      source: observable,
      sample: observable,
      parsed: computed,
      state: computed,
      member: computed,
      sampleMatches: computed,
      matchingCalls: computed,
      setSource: action,
      setSample: action,
      insert: action,
      erase: action,
    });
  }

  get parsed(): TResult<NumberMask, readonly TMaskError[]> | null {
    if (this.source.trim() === '') {
      return null;
    }
    return parseNumberMask(this.source);
  }

  get state(): TMaskState {
    const { parsed } = this;
    if (parsed === null) {
      return { kind: 'empty' };
    }
    if (!parsed.ok) {
      return { kind: 'invalid', errors: parsed.error };
    }
    const canonical = canonicalNumberPattern(parsed.value, this.ports.environment().home);
    if (!canonical.ok) {
      return { kind: 'not-here', error: canonical.error };
    }
    const example = exampleOf(canonical.value, NUMBER_FILLER);
    return {
      kind: 'valid',
      tokens: describePattern(parsed.value.pattern),
      international: parsed.value.international,
      example: this.ports.numbering.format(example as TE164Digits),
      takesEveryone: isEveryone(canonical.value),
    };
  }

  /** Whether saving rewrites a mask of a group rather than adding one. */
  get rewrites(): boolean {
    return this.start.kind === 'rewrite';
  }

  /** The member saving would add, or the rewrite of the one it started from; `null` while the mask does not hold. */
  get member(): INumberMaskMember | null {
    const { parsed } = this;
    if (parsed === null || !parsed.ok || this.state.kind !== 'valid') {
      return null;
    }
    const core = {
      id: this.start.kind === 'rewrite' ? this.start.member.id : this.ports.newMemberId(),
      updatedAt: this.ports.now(),
      excludedFor: null,
      note: '',
    };
    return { kind: 'number-mask', mask: parsed.value, ...core };
  }

  get sampleMatches(): boolean | null {
    const { member } = this;
    if (member === null || this.sample.trim() === '') {
      return null;
    }
    const environment = this.ports.environment();
    const caller: ICaller = {
      number: this.ports.numbering.parse(this.sample, environment.home.country),
      traits: null,
      networkName: null,
      contact: null,
      dialer: null,
    };
    return matchMember(member, caller, environment) !== null;
  }

  get matchingCalls(): number {
    const { member } = this;
    if (member === null) {
      return 0;
    }
    const environment = this.ports.environment();
    return this.ports
      .knownCallers()
      .filter(caller => matchMember(member, caller, environment) !== null).length;
  }

  setSource(source: string): void {
    this.source = source;
  }

  setSample(sample: string): void {
    this.sample = sample;
  }

  insert(text: string): void {
    this.source += text;
  }

  erase(): void {
    this.source = this.source.slice(0, -1);
  }
}
