import type {
  INumberingStates,
  TNumberingCountry,
  TNumberingOperator,
  TNumberingService,
} from '../../contexts/phone/domain/numbering/gen/numbering-codes';

/** Names of the numbering catalogue's codes; a language that misses one does not compile. */
export interface INumberingTexts {
  readonly countries: Readonly<Record<TNumberingCountry, string>>;
  readonly states: {
    readonly [Country in keyof INumberingStates]: Readonly<
      Record<INumberingStates[Country], string>
    >;
  };
  readonly operators: Readonly<Record<TNumberingOperator, string>>;
  readonly services: Readonly<Record<TNumberingService, string>>;
}
