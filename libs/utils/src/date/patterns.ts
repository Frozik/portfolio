export const COLON_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
export const OFFSET_TOKEN_REGEX = /^([+-])(\d+)(d|w|m|y)$/i;
export const DURATION_TOKEN_REGEX = /^(\d+)(d|w|m|y)$/i;
export const ORDINAL_TOKEN_REGEX = /^(\d{1,2})(?:st|nd|rd|th)$/i;
export const QUARTER_TOKEN_REGEX = /^q([1-4])$/i;
export const QUARTER_N_TOKEN_REGEX = /^([1-4])q$/i;
export const APOSTROPHE_YEAR_REGEX = /^'(\d{2})$/;
export const AMPM_REGEX = /^(am|pm)$/i;
export const NUMBER_WITH_AMPM_REGEX = /^(\d{1,2})(am|pm)$/i;
export const COLON_TIME_WITH_AMPM_REGEX =
  /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(am|pm)$/i;

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
export const SLASH_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export const DOT_DATE_REGEX = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
export const DASH_DATE_DD_MM_YYYY_REGEX = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
export const ISO_MONTH_REGEX = /^(\d{4})-(\d{2})$/;
export const SLASH_MONTH_REGEX = /^(\d{1,2})\/(\d{4})$/;

export const STANDALONE_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
export const AMPM_TIME_REGEX = /^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i;

export const QUARTER_Q_FULL_REGEX = /^q([1-4])(?:[\s/]'?(\d{2,4}))?$/i;
export const QUARTER_NQ_FULL_REGEX = /^([1-4])q'?(\d{2,4})$/i;

export const TIME_SUFFIX_REGEX = /\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
export const AMPM_SUFFIX_REGEX = /\s+(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i;
export const BARE_TIME_SUFFIX_REGEX =
  /\s+(\d{1,2})(?:\s+(\d{1,2})(?:\s+(\d{1,2})(?:\s+(\d{1,3}))?)?)?$/;

export const MONTH_NAME_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

export const MONTH_YEAR_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:'(\d{2})|(\d{4}))$/i;

export const YEAR_MONTH_REGEX =
  /^(\d{4})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

export const DAY_MONTH_REGEX =
  /^(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

export const MONTH_DAY_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?$/i;

export const DAY_MONTH_YEAR_REGEX =
  /^(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*'?(\d{2,4})$/i;

export const MONTH_DAY_YEAR_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?,?\s+'?(\d{2,4})$/i;

export const OFFSET_REGEX = /^([+-])(\d+)\s*(d|w|m|y)$/i;
export const DURATION_FULL_REGEX = /^(\d+)\s*(d|w|m|y)$/i;
export const IN_N_UNITS_REGEX = /^in\s+(\d+)\s+(day|week|month|year)s?$/i;
export const N_UNITS_AGO_REGEX = /^(\d+)\s+(day|week|month|year)s?\s+ago$/i;

export const NEXT_LAST_WEEKDAY_REGEX =
  /^(next|last)\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/i;

export const NUMERIC_SPACE_DATE_REGEX = /^(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})$/;
export const ORDINAL_DAY_REGEX = /^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/i;
