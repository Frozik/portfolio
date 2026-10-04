# Sudoku

Sudoku with four difficulties, pen and notes modes, undo and validation.

Live: [https://frozik.github.io/portfolio/sudoku](https://frozik.github.io/portfolio/sudoku) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/sudoku/`.

Sudoku game with four difficulty levels, pen/notes tool modes, undo history,
and field validation.

## Number-aware board

Picking a number on the keypad turns the board into a map for that number:

- every cell already holding it is highlighted, notes included;
- in pen mode, every empty cell where it can legally go — none of its row,
  column or group holds the number yet — gets a barely visible green tint,
  faint enough not to pull the eye away from the digits;
- notes mode shows no targets: a candidate is the player's hypothesis and
  may be written anywhere a note is allowed.

The green is a hint, not a lock: the pen still writes wherever the player
clicks, and validation marks a conflict red as before. The rule lives in
the domain (`canPlaceValue`) and only the cell styling reads it.

## Agent tools

With WebMCP on (see [the app README](../../../README.md#agent-tools-webmcp)),
an open sudoku registers nine tools: `sudoku_get_board`, `sudoku_new_puzzle`,
`sudoku_write_digit`, `sudoku_erase_digit`, `sudoku_toggle_note`,
`sudoku_fill_candidates` (the candidate button in one call instead of a toggle
per digit), `sudoku_hint`, `sudoku_check` and `sudoku_undo`. The board comes back as nine strings plus the givens, conflicts
and notes, with 1-based rows and columns as a person counts them. An agent's
move goes through the store like a click, so it lands in the same undo history
and validation, but it never changes the number the player picked on the
keypad. Givens are refused with an `{ error }` result; a clashing digit is accepted and reported as a
conflict, exactly as the pen behaves for the player.

There is deliberately no "solve" tool: the agent does the reasoning and gets
two aids that keep it honest.

- `sudoku_hint` returns the next digit plain logic forces and why — a cell
  with one candidate left (naked single) or a digit with one place left in a
  box, row or column (hidden single) — found by `domain/hints.ts` from the
  digits on the board. Chained, the hints solve an easy puzzle on their own;
  harder ones run out of singles and say so.
- `sudoku_check` lists the player digits that disagree with the solution,
  including the ones that clash with nothing yet, which `conflicts` cannot
  see — without revealing the right digits. The solution comes from
  `domain/solution.ts`, a depth-first search over the givens that branches on
  the cell with the fewest candidates.
