export const webMcpTranslationsEn = {
  hero: {
    sectionKicker: 'webmcp',
    headlinePrimary: 'Agent-ready',
    headlineAccent: 'through WebMCP',
    subtitle:
      'WebMCP is a proposed web standard: a page hands the AI agents in your browser typed tools instead of leaving them to guess at buttons. The demos of this site expose their state and actions that way — an agent reads a chart, filters a table or plays sudoku through the same code paths as your clicks.',
    docsLink: 'WebMCP for developers',
    userGuideLink: 'Let Gemini in Chrome act on pages for you',
  },
  catalog: {
    sectionKicker: 'tools',
    title: 'Which demos support it, and their commands',
    openDemo: 'Open the demo',
    sections: {
      everywhere: {
        title: 'Every page',
        summary: 'Finding your way around the site.',
      },
      sudoku: {
        title: 'Sudoku',
        summary:
          'The board as nine strings with givens, conflicts and notes; moves land in the player’s undo history and never change the number picked on the keypad.',
      },
      timeseries: {
        title: 'Charts',
        summary:
          'Every chart of the open page, chosen by id. Positions are local date-times or plain words (“yesterday 10:00”); commands answer with what the chart now shows.',
      },
      table: {
        title: 'Table',
        summary:
          'The showcase table: reads rows as displayed, filters with the same models as the filter row, and edits through the editing slice with its validation and confirm flow.',
      },
      controls: {
        title: 'Controls',
        summary:
          'The two fields take exactly the text a person would type and settle it the way the editors do — suffixes, rounding, natural-language dates, clamping.',
      },
    },
    tools: {
      portfolio_list_demos: 'Lists the demos and which one is open.',
      portfolio_open_demo: 'Navigates to a demo.',
      sudoku_get_board: 'Reads the board.',
      sudoku_new_puzzle: 'Starts a puzzle of a chosen difficulty.',
      sudoku_write_digit: 'Writes a digit into a cell.',
      sudoku_erase_digit: 'Empties a cell the player filled.',
      sudoku_toggle_note: 'Adds or removes a pencilled candidate.',
      sudoku_fill_candidates: 'Pencils every legal candidate at once.',
      sudoku_hint: 'Suggests the next forced digit and explains why.',
      sudoku_check: 'Lists the player’s wrong digits without revealing the right ones.',
      sudoku_undo: 'Reverts the last move.',
      timeseries_list_charts: 'Describes each chart: range in view, data, scales, series.',
      timeseries_zoom: 'Zooms along X round a position, as the wheel does.',
      timeseries_scroll: 'Scrolls by screen widths, left or right.',
      timeseries_go_to: 'Centres a chart on a position.',
      timeseries_show_range: 'Shows an exact range.',
      timeseries_fit: 'Shows all the loaded data.',
      timeseries_zoom_scale: 'Stretches a value scale and holds it.',
      timeseries_reset_scales: 'Hands value scales back to auto-scaling.',
      timeseries_follow_live: 'Returns a live chart to its newest data.',
      timeseries_values_at: 'Reads each series’ value at a position.',
      timeseries_open_page: 'Switches the charts demo page.',
      trades_describe: 'Describes columns, counts, sort, filters and pending edits.',
      trades_read_rows: 'Reads rows by display index.',
      trades_scroll_to_row: 'Scrolls to a row by index or key.',
      trades_scroll: 'Scrolls by pages.',
      trades_sort: 'Sorts by a column.',
      trades_set_filter: 'Sets or clears a column filter.',
      trades_clear_filters: 'Removes every filter and the search.',
      trades_search: 'Searches the text columns.',
      trades_edit_cell: 'Edits a cell.',
      trades_settle_edits: 'Confirms or reverts edits awaiting confirmation.',
      controls_number_read: 'Reads the number field and its rounding rule.',
      controls_number_enter: 'Types text into the number field.',
      controls_date_read: 'Reads the date field.',
      controls_date_enter: 'Types a date into the date field, in words or ISO.',
      controls_read_settings: 'Reads how both fields are set up.',
      controls_set_number_format: 'Sets decimals and highlighted pip digits.',
      controls_set_date_options: 'Sets arrow step, time precision and parse direction.',
    },
  },
} as const;
