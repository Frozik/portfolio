# Fuzzy date parser

`parseFuzzyDate(input, { now, timeZone, nearest })` reads a date or a time
written the way people type it — `tom 13:00`, `15 jan`, `+3d`, `eom`,
`Q2 2025`, `9:30 45`.

`now` is the moment of asking, a `Temporal.Instant`. `timeZone` is the zone
whose calendar and clock the input is read on: asked at the same moment,
`today` is the 15th in Los Angeles and the 16th in Auckland. The answer is a
`Temporal.ZonedDateTime` in that zone. The two are told apart on purpose: a
moment has no zone of its own, so they cannot disagree, and the zone cannot be
left out. A zone the platform does not know is a mistake in the calling
code, not in the input, so it is an exception rather than a failed parse.

```
text ──▶ lexer ──▶ tokens ──▶ scoring ──▶ weighed numbers ──▶ resolution ──▶ moment
```

Each layer is a pure function of the previous layer's output and knows nothing
of the layers after it. What the parser understands lives in tables; the code
around a table only walks it.

## The slots

A moment has seven slots: year, month, day, hour, minute, second, millisecond
(`slot.ts`). Parsing is filling them. A word fills its slots for certain — `jan`
is the month, `13:00` the hour and the minute. A bare number is ambiguous —
`10` may be a day, a month, an hour — and the two upper layers exist to decide it.

## Layer 1 · `lexer/` — text to tokens

| Step | File | What it holds |
| --- | --- | --- |
| Normalise | `tokenize.ts` | Text copied from a page is read as typed: a non-breaking space, full-width digits, typographic dashes. |
| | `decimals.ts` | The scanner cuts `1.5h` at the dot, as it must cut `15.03`. A fraction that runs into a unit is joined back: `1.5h`, `1,5 hours`. |
| Scan | `scanner.ts` | A finite-state machine as a table: state × character class → transition. It cuts the text into lexemes and remembers the separator (`-` `/` `.`) each one was joined by. A clock time is one lexeme, and so is a signed offset. |
| Classify | `vocabulary.ts` | Words: months, weekdays, keywords, the edges of periods, units, time zones, and the fillers `at` `on` `of` `the`. |
| | `shapes.ts` | Patterns tried in order: `9:30`, `+3d`, `1h30min`, `15th`, `1q25`, `10nov`, `+0200`. |
| Merge | `phrases.ts` | Neighbouring tokens that mean one thing: `in 3 days`, `next fri`, `end of next month`, `day after tomorrow`, `p.m.`. The fillers are dropped after that. |

A token is a discriminated union (`token.ts`): every kind carries its own
fields, so nothing downstream parses a string again.

Every row of `shapes.ts` and `phrases.ts` carries examples of what it reads.
They are not comments: the tests read each example and check that it is the
row itself that reads it, not a row above.

## Layer 2 · `scoring/` — numbers to weights

Every bare number starts with a weight per slot, judged by its size alone
(`plausibility.ts`): `2025` can only be a year, `45` never a day. Zero means
impossible, and no rule revives it. Then `rules.ts` is applied top to bottom.
A rule is one of three kinds:

- `close` — the numbers in scope cannot be these slots;
- `settle` — the numbers in scope take this slot as their seat;
- `readInOrder` — the numbers still without a seat are read in one of the
  orders people write them in.

A rule is scoped by `when` (a condition on the whole input, `board-conditions.ts`)
and `whose` (a test of one number, `number-tests.ts`).

### Reading orders

`reading-orders.ts` lists the ways a date is written in numbers (`15 06 27`,
`06 15 27`, `2027 06 15`, `15 06`, `06 2027`, …; a year that does not stand
last must be unmistakable — `2027` or `99`, not `27`) and joins each with every
length of time, the date first or the time first. An order can be taken only
if it has a free seat for every number and every number can be what its seat
says: in `8 30 15 06 27` the first number cannot be the day, because 30 is
no month, so the date reads month-day-year.

Of the orders that can be taken, the best wins. What makes one better, the
weightiest reason first:

1. it keeps the date in one piece and the time in one piece;
2. it has the date before the time;
3. it leaves less unsaid — no date short of a part, no hour without minutes;
4. it names a date — `15 06 27` is a date rather than 15:06:27;
5. the numbers weigh more on its seats — `1 01 17 00` is 1 January 17:00
   rather than 1 January 2017 at midnight;
6. its date order is the more usual.

A number no order seats is left no reading, and the parse fails.

Every weighed number keeps the names of the rules that changed it
(`changedBy`), in order. To see why `27` in `15 jan 27` became the year, look
at the trail `scoreCandidates(tokenize('15 jan 27'))` returns.

## Layer 3 · `resolution/` — weights to a moment

1. `assign-slots.ts` — the most confident reading is settled first, then the
   most confident among what is left. A number left without a slot fails the parse.
2. `word-values.ts` — the values the words give to their slots, computed from `now`.
3. `resolve.ts` — both are combined. A slot told twice is a contradiction and
   fails the parse: the parser never drops a part of the input it cannot place.
   An offset is not a statement but a shift of what the rest says: `eom -4h`
   is four hours before the end of the month. With nothing else said it
   shifts today — or this very moment, when it counts hours or minutes.
   A part of the day (`evening`, `tonight`) gives its usual hour when no time
   is told, and the half of the day when an hour of the dial is: `tonight at
   9` is 21:00.
   A weekday is a statement only alone (`fri`). Beside a date told some other
   way it confirms the date (`wed 15 jan 2025`) or, while the date still
   recurs, keeps the occurrences that fall on it (`fri 13th`).
4. `clock.ts` — the time of day, on the clock of `now` or of the time zone the
   input names (`14:30Z`, `14:30+02:00`); `date-shapes.ts` — the date, read by
   which of its parts are known. Parts left untold make the date recur (`15th` every
   month, `15 jan` every year, `13:00` every day), and the first occurrence not
   yet past is taken — after the offsets have shifted it. With `nearest`, today's occurrence is kept even when its
   time has passed.

## Extending the format

| To teach the parser | Add |
| --- | --- |
| a word (`overmorrow`, a month in another language) | a row in `lexer/vocabulary.ts` |
| a way to write one lexeme (`15h30`) | a row in `lexer/shapes.ts` |
| a phrase of several words (`day after tomorrow`) | a row in `lexer/phrases.ts` |
| a hint about what a number is | a row in `scoring/rules.ts` |
| an order a date is written in | a row in `DATE_ORDERS` of `scoring/reading-orders.ts` |
| a way to complete a partial date | a row in `resolution/date-shapes.ts` |
| a new kind of token | a member of `Token`; the compiler then points at `scoring/stated-slots.ts` and `resolution/word-values.ts`, the two places that must say what it states |

After a change to a table, `parseFuzzyDate.combinations.test.ts` tells whether
every way to write a date still reads with every way to write a time.
