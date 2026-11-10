import type { TResult } from '@frozik/utils/result/result';
import { action, computed, makeObservable, observable } from 'mobx';

import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type {
  INameMaskMember,
  INumberMaskMember,
  TMemberId,
  TNameField,
} from '../../grouping/domain/member';
import { matchMember } from '../../grouping/domain/member-matching';
import type { ICaller, TE164Digits } from '../../phone/domain/caller';
import { normalizeName } from '../../phone/domain/name-normalization';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import type { TMaskToken } from '../domain/mask-description';
import { describePattern, exampleOf } from '../domain/mask-description';
import type { TMaskError } from '../domain/mask-error';
import type { NameMask } from '../domain/name-mask';
import { parseNameMask } from '../domain/name-mask';
import type { NumberMask } from '../domain/number-mask';
import { parseNumberMask } from '../domain/number-mask';
import type { TCanonicalError } from '../domain/number-mask-canonical';
import { canonicalNumberPattern } from '../domain/number-mask-canonical';
import type { TPattern } from '../domain/pattern';

export type TMaskKind = 'number' | 'name';

/** Where the editor starts: a new mask (empty, or a call's number or name), or one of a group to rewrite. */
export type TMaskStart =
  | { readonly kind: 'new'; readonly mask: TMaskKind; readonly seed: string }
  | { readonly kind: 'rewrite'; readonly member: INumberMaskMember | INameMaskMember };

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
const NAME_FILLER = 'a';

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
  kind: TMaskKind;
  source: string;
  field: TNameField;
  sample = '';

  constructor(
    private readonly ports: IEditorPorts,
    private readonly start: TMaskStart
  ) {
    if (start.kind === 'new') {
      this.kind = start.mask;
      this.source = start.seed;
      this.field = 'any';
    } else {
      const { member } = start;
      this.kind = member.kind === 'number-mask' ? 'number' : 'name';
      this.source = member.mask.source;
      this.field = member.kind === 'name-mask' ? member.field : 'any';
    }
    makeObservable(this, {
      kind: observable,
      source: observable,
      field: observable,
      sample: observable,
      parsed: computed,
      state: computed,
      member: computed,
      sampleMatches: computed,
      matchingCalls: computed,
      setKind: action,
      setSource: action,
      setField: action,
      setSample: action,
      insert: action,
      erase: action,
      wrap: action,
    });
  }

  get parsed(): TResult<NumberMask | NameMask, readonly TMaskError[]> | null {
    if (this.source.trim() === '') {
      return null;
    }
    return this.kind === 'number' ? parseNumberMask(this.source) : parseNameMask(this.source);
  }

  get state(): TMaskState {
    const { parsed } = this;
    if (parsed === null) {
      return { kind: 'empty' };
    }
    if (!parsed.ok) {
      return { kind: 'invalid', errors: parsed.error };
    }
    const international = 'international' in parsed.value ? parsed.value.international : false;
    let pattern = parsed.value.pattern;
    if (this.kind === 'number') {
      const canonical = canonicalNumberPattern(
        parsed.value as NumberMask,
        this.ports.environment().home
      );
      if (!canonical.ok) {
        return { kind: 'not-here', error: canonical.error };
      }
      pattern = canonical.value;
    }
    const example = exampleOf(pattern, this.kind === 'number' ? NUMBER_FILLER : NAME_FILLER);
    return {
      kind: 'valid',
      tokens: describePattern(parsed.value.pattern),
      international,
      example:
        this.kind === 'number' ? this.ports.numbering.format(example as TE164Digits) : example,
      takesEveryone: isEveryone(pattern),
    };
  }

  /** Whether saving rewrites a mask of a group rather than adding one. */
  get rewrites(): boolean {
    return this.start.kind === 'rewrite';
  }

  /** The member saving would add, or the rewrite of the one it started from; `null` while the mask does not hold. */
  get member(): INumberMaskMember | INameMaskMember | null {
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
    return this.kind === 'number'
      ? { kind: 'number-mask', mask: parsed.value as NumberMask, ...core }
      : { kind: 'name-mask', mask: parsed.value as NameMask, field: this.field, ...core };
  }

  get sampleMatches(): boolean | null {
    const { member } = this;
    if (member === null || this.sample.trim() === '') {
      return null;
    }
    const environment = this.ports.environment();
    const caller: ICaller =
      this.kind === 'number'
        ? {
            number: this.ports.numbering.parse(this.sample, environment.home.country),
            traits: null,
            networkName: null,
            contact: null,
          }
        : {
            number: null,
            traits: null,
            networkName: normalizeName(this.sample),
            contact: { lookupKey: '', displayName: this.sample, name: normalizeName(this.sample) },
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

  setKind(kind: TMaskKind): void {
    this.kind = kind;
  }

  setSource(source: string): void {
    this.source = source;
  }

  setField(field: TNameField): void {
    this.field = field;
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

  /** «Contains», «starts with», «exactly» for a name typed as plain words. */
  wrap(how: 'contains' | 'starts' | 'exact'): void {
    const bare = this.source.replace(/^\*+|\*+$/g, '');
    this.source = how === 'contains' ? `*${bare}*` : how === 'starts' ? `${bare}*` : bare;
  }
}
