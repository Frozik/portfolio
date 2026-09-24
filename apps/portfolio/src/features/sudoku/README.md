# Sudoku

Sudoku with four difficulties, pen and notes modes, undo and validation.

Live: [https://frozik.github.io/portfolio/sudoku](https://frozik.github.io/portfolio/sudoku) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/sudoku/`.

Sudoku game with four difficulty levels, pen/notes tool modes, undo history,
and field validation.

## Number-aware board

Picking a number on the keypad turns the board into a map for that number:

- every cell already holding it is highlighted, notes included;
- in pen mode, every empty cell where it can legally go — none of its row,
  column or group holds the number yet — gets a dark green background;
- notes mode shows no targets: a candidate is the player's hypothesis and
  may be written anywhere a note is allowed.

The green is a hint, not a lock: the pen still writes wherever the player
clicks, and validation marks a conflict red as before. The rule lives in
the domain (`canPlaceValue`) and only the cell styling reads it.
