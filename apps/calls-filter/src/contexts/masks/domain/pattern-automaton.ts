import type { TPattern, TPatternSymbol } from './pattern';
import type { TPatternAlphabet } from './pattern-regex';

interface ITransition {
  readonly symbol: TPatternSymbol;
  readonly to: number;
}

/** A nondeterministic automaton with ε-moves; state 0 starts, `accepting` ends. */
interface IAutomaton {
  readonly transitions: readonly (readonly ITransition[])[];
  readonly epsilon: readonly (readonly number[])[];
  readonly accepting: number;
}

class AutomatonBuilder {
  readonly transitions: ITransition[][] = [[]];
  readonly epsilon: number[][] = [[]];

  addState(): number {
    this.transitions.push([]);
    this.epsilon.push([]);
    return this.transitions.length - 1;
  }

  step(from: number, symbol: TPatternSymbol, to: number): void {
    this.transitions[from]?.push({ symbol, to });
  }

  skip(from: number, to: number): void {
    this.epsilon[from]?.push(to);
  }
}

function buildAutomaton(pattern: TPattern): IAutomaton {
  const builder = new AutomatonBuilder();
  let current = 0;
  for (const element of pattern) {
    for (let copy = 0; copy < element.min; copy += 1) {
      const next = builder.addState();
      builder.step(current, element.symbol, next);
      current = next;
    }
    if (element.max === null) {
      builder.step(current, element.symbol, current);
      continue;
    }
    const end = builder.addState();
    builder.skip(current, end);
    for (let copy = element.min; copy < element.max; copy += 1) {
      const next = builder.addState();
      builder.step(current, element.symbol, next);
      builder.skip(next, end);
      current = next;
    }
    current = end;
  }
  return { transitions: builder.transitions, epsilon: builder.epsilon, accepting: current };
}

type TStateSet = readonly number[];

function closure(automaton: IAutomaton, states: Iterable<number>): TStateSet {
  const reached = new Set<number>();
  const pending = [...states];
  while (pending.length > 0) {
    const state = pending.pop() ?? 0;
    if (!reached.has(state)) {
      reached.add(state);
      pending.push(...(automaton.epsilon[state] ?? []));
    }
  }
  return [...reached].sort((left, right) => left - right);
}

function advance(automaton: IAutomaton, states: TStateSet, character: string): TStateSet {
  const next = new Set<number>();
  for (const state of states) {
    for (const transition of automaton.transitions[state] ?? []) {
      if (transition.symbol.kind === 'any' || transition.symbol.value === character) {
        next.add(transition.to);
      }
    }
  }
  return closure(automaton, next);
}

function accepts(automaton: IAutomaton, states: TStateSet): boolean {
  return states.includes(automaton.accepting);
}

function literalsOf(automaton: IAutomaton): readonly string[] {
  return automaton.transitions.flatMap(list =>
    list.flatMap(transition =>
      transition.symbol.kind === 'literal' ? [transition.symbol.value] : []
    )
  );
}

const DIGIT_ALPHABET = '0123456789';
const TEXT_FILLERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * The characters worth trying: every literal any automaton mentions, plus one character
 * none of them mentions (it stands for all the others, which every automaton treats alike).
 */
function candidateCharacters(
  automata: readonly IAutomaton[],
  alphabet: TPatternAlphabet
): readonly string[] {
  const literals = new Set(automata.flatMap(literalsOf));
  const pool = alphabet === 'digits' ? DIGIT_ALPHABET : TEXT_FILLERS;
  const filler = [...pool].find(character => !literals.has(character));
  return filler === undefined ? [...literals] : [...literals, filler];
}

export interface IIntersectionQuery {
  /** Every one of these must accept the example. */
  readonly required: readonly TPattern[];
  /** None of these may accept it. */
  readonly forbidden: readonly TPattern[];
  readonly alphabet: TPatternAlphabet;
  /** The longest example worth reporting: a number has at most fifteen digits. */
  readonly maxLength: number;
}

/**
 * The shortest string every required pattern accepts and no forbidden pattern does, or
 * `null` when there is none: a breadth-first walk over the product of the automata,
 * determinized on the fly. It proves an absence as well as it finds an example.
 */
export function findIntersection(query: IIntersectionQuery): string | null {
  const required = query.required.map(buildAutomaton);
  const forbidden = query.forbidden.map(buildAutomaton);
  const all = [...required, ...forbidden];
  const characters = candidateCharacters(all, query.alphabet);
  const start = all.map(automaton => closure(automaton, [0]));
  const key = (sets: readonly TStateSet[]): string => sets.map(set => set.join(',')).join('|');

  let frontier: { readonly sets: readonly TStateSet[]; readonly text: string }[] = [
    { sets: start, text: '' },
  ];
  const seen = new Set([key(start)]);
  for (let length = 0; length <= query.maxLength; length += 1) {
    const next: typeof frontier = [];
    for (const { sets, text } of frontier) {
      const isWanted =
        required.every((automaton, index) => accepts(automaton, sets[index] ?? [])) &&
        forbidden.every(
          (automaton, index) => !accepts(automaton, sets[required.length + index] ?? [])
        );
      if (isWanted) {
        return text;
      }
      for (const character of characters) {
        const moved = all.map((automaton, index) =>
          advance(automaton, sets[index] ?? [], character)
        );
        const isAlive = required.every((_automaton, index) => (moved[index]?.length ?? 0) > 0);
        const movedKey = key(moved);
        if (isAlive && !seen.has(movedKey)) {
          seen.add(movedKey);
          next.push({ sets: moved, text: text + character });
        }
      }
    }
    frontier = next;
  }
  return null;
}
