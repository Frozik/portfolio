import type { webMcpTranslationsEn } from './translations/en';

type TCatalog = (typeof webMcpTranslationsEn)['catalog'];

export interface IToolSection {
  readonly id: keyof TCatalog['sections'];
  /** The demo the tools live on; none for the tools every page has. */
  readonly route?: string;
  readonly tools: readonly (keyof TCatalog['tools'])[];
}

export const TOOL_CATALOG: readonly IToolSection[] = [
  { id: 'everywhere', tools: ['portfolio_list_demos', 'portfolio_open_demo'] },
  {
    id: 'sudoku',
    route: '/sudoku',
    tools: [
      'sudoku_get_board',
      'sudoku_new_puzzle',
      'sudoku_write_digit',
      'sudoku_erase_digit',
      'sudoku_toggle_note',
      'sudoku_fill_candidates',
      'sudoku_hint',
      'sudoku_check',
      'sudoku_undo',
    ],
  },
  {
    id: 'timeseries',
    route: '/timeseries',
    tools: [
      'timeseries_list_charts',
      'timeseries_zoom',
      'timeseries_scroll',
      'timeseries_go_to',
      'timeseries_show_range',
      'timeseries_fit',
      'timeseries_zoom_scale',
      'timeseries_reset_scales',
      'timeseries_follow_live',
      'timeseries_values_at',
      'timeseries_open_page',
    ],
  },
  {
    id: 'table',
    route: '/table',
    tools: [
      'trades_describe',
      'trades_read_rows',
      'trades_scroll_to_row',
      'trades_scroll',
      'trades_sort',
      'trades_set_filter',
      'trades_clear_filters',
      'trades_search',
      'trades_edit_cell',
      'trades_settle_edits',
    ],
  },
  {
    id: 'controls',
    route: '/controls',
    tools: [
      'controls_number_read',
      'controls_number_enter',
      'controls_date_read',
      'controls_date_enter',
      'controls_read_settings',
      'controls_set_number_format',
      'controls_set_date_options',
      'controls_form_tab_read',
      'controls_form_tab_open',
      'controls_form_site_read',
      'controls_form_site_enter',
      'controls_form_login_read',
      'controls_form_login_enter',
      'controls_form_groups_read',
      'controls_form_groups_set',
      'controls_form_favorite_read',
      'controls_form_favorite_set',
      'controls_form_bank_read',
      'controls_form_bank_enter',
      'controls_form_iban_read',
      'controls_form_iban_enter',
      'controls_form_phone_read',
      'controls_form_phone_enter',
      'controls_form_expiry_read',
      'controls_form_expiry_enter',
      'controls_form_currency_read',
      'controls_form_currency_choose',
      'controls_form_notes_read',
      'controls_form_notes_enter',
    ],
  },
];
