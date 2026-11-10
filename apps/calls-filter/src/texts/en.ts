import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TWeekday } from '../contexts/policy/domain/schedule';
import { EN_CHECK } from './en-check';
import { EN_MASK } from './en-mask';
import { EN_PLACE } from './en-place';
import { EN_SCHEDULE } from './en-schedule';
import { EN_SYNC } from './en-sync';
import { EN_NUMBERING } from './numbering/en';
import { plural } from './plural';
import type { ITexts } from './texts';

const count = (value: number, one: string, other: string) =>
  plural('en', value, { one: `# ${one}`, other: `# ${other}` });

const WEEKDAYS: Readonly<Record<TWeekday, string>> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export const EN: ITexts = {
  tabs: { groups: 'Groups', calls: 'Calls', settings: 'Settings' },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    done: 'Done',
    undo: 'Undo',
    delete: 'Delete',
    add: 'Add',
    back: 'Back',
    more: 'More',
    copy: 'Copy',
    today: 'Today',
    yesterday: 'Yesterday',
  },
  actions: { block: 'Block', pass: 'Let through' },
  actionsShort: { block: '⛔ block', pass: '✅ pass' },
  verdicts: {
    passed: 'let through',
    rejected: 'rejected',
    'awaiting-repeat': 'rejected, waiting for a repeat',
    'passed-as-repeat': 'let through as a repeat',
    paused: 'let through, filter paused',
  },
  groups: {
    title: 'Groups',
    filterOn: 'Filter is on',
    pausedUntil: time => `Paused until ${time}`,
    pinned: 'A built-in group: it can be neither renamed nor deleted',
    resume: 'Resume',
    pause: 'Pause',
    newGroup: 'Group',
    myContacts: 'My contacts',
    strangers: 'Strangers',
    createFirst: 'Create a group to sort your calls',
    roleMissing: 'Calls Filter cannot screen calls yet',
    roleButton: 'Allow',
    conflicts: value => plural('en', value, { one: '⚠ # conflict', other: '⚠ # conflicts' }),
    nowAlways: action => `${action} always`,
    nowUntil: (action, until, then) => `${action} until ${until}, then ${then}`,
    callsToday: value => String(value),
  },
  temporary: {
    usually: phrase => `Usually: ${phrase}`,
    what: 'For a while',
    short: 'Temporary',
    forHow: 'For',
    hour: '1 hour',
    evening: 'Until evening',
    days: value => count(value, 'day', 'days'),
    firstCall: 'Until the first call',
    endOfEvent: 'Until the meeting ends',
    backToUsual: 'Back to usual',
    active: (action, until) => `${action} until ${until}`,
  },
  repeat: {
    title: 'A repeat call rings',
    short: 'Repeat',
    groupHint: minutes =>
      `When this group blocks, a second call within ${count(minutes, 'minute', 'minutes')} rings`,
    filterHint: 'For every group that blocks, as if each had it on',
    hiddenMiss:
      'Hidden numbers land in this group, and a hidden number cannot show it is calling again: those calls stay blocked',
    off: 'Off',
    always: 'Always',
    until: moment => `Until ${moment}`,
    hours: value => count(value, 'hour', 'hours'),
    days: value => count(value, 'day', 'days'),
    untilDate: 'Until a date…',
  },
  pause: {
    title: 'Pause the whole filter',
    hours: value => count(value, 'hour', 'hours'),
    days: value => count(value, 'day', 'days'),
    weeks: value => count(value, 'week', 'weeks'),
    untilTomorrow: 'Until tomorrow',
  },
  group: {
    calls: 'Calls',
    rules: 'Rules',
    noCalls: 'No calls yet',
    who: 'Who',
    include: 'Include',
    exclude: 'Exclude',
    addMask: 'Add a mask: number or name',
    addNameMask: '+ Name',
    addContact: 'Add a contact',
    excludeMyContacts: 'Exclude my contacts',
    whatToDo: 'What to do',
    whileMet: 'While the condition holds',
    otherwise: 'The rest of the time',
    addSchedule: '+ Schedule',
    schedule: 'Schedule',
    calendars: 'Calendars',
    addCalendars: '+ Calendars',
    noSchedule: 'all the time',
    repeatWindow: minutes => `A repeat counts within ${count(minutes, 'minute', 'minutes')}`,
    autoReply: 'SMS reply to contacts',
    smsShort: 'SMS',
    autoReplyHint:
      'Sent to a contact this group rejects, at most once per meeting; never when roaming',
    name: 'Name',
    color: 'Colour',
    colorThemed: 'Main colours — shaded for the light and the dark theme',
    colorPalette: 'Any colour — drag on the square and the strip',
    colorHex: 'Hex, e.g. FF8800',
    colorChange: 'Change colour',
    colorMore: 'More colours',
    deleteGroup: 'Delete group',
    myContactsWho: 'Include: all my contacts',
    myContactsHint: 'Contacts you add to other groups are excluded from here by themselves',
    strangersWho: 'Calls land here by themselves when no group takes them by number or by name',
    memberNote: note => note,
    rename: 'Rename',
    specialTitle: 'Also include',
    emptySide: 'Nobody yet',
    special: {
      hidden: 'Hidden numbers',
      foreign: 'Foreign',
      'premium-rate': 'Premium-rate',
      voip: 'VoIP',
      'toll-free': 'Toll-free',
    },
    specialHint: {
      hidden: 'Calls that hide their number',
      foreign: 'Numbers of another country than the network you are on now',
      'premium-rate': "Paid numbers by the country's own plan: calling them back costs extra",
      voip: 'Internet telephony numbers, a favourite of robocallers',
      'toll-free':
        "Free-to-call numbers by the country's own plan — 0800 in the Netherlands, 8 800 in Russia, 1-800 in the US; often call centres",
    },
    nameField: { network: 'operator name', contact: 'contact name', any: 'any name' },
    excludedFor: group => `moved to «${group}»`,
  },
  call: {
    fromOperator: 'from operator',
    fromDialer: 'by the Phone app',
    hidden: 'Hidden number',
    move: 'To group…',
    moveTitle: 'Move to a group',
    byNumber: 'By number',
    byName: 'By name',
    newGroup: '+ New group',
    remove: 'Remove from group',
    callBack: 'Call back',
    openContact: 'Open contact',
    fromHistory: 'from the phone history',
    similar: 'Similar — to a mask…',
    why: (group, verdict) => `«${group}»: ${verdict}`,
    inSeveral: groups => `In several groups: ${groups}`,
    addHidden: 'Add «Hidden numbers» to a group…',
    calls: value => (value > 1 ? `×${value}` : ''),
  },
  mask: EN_MASK,
  conflict: {
    title: 'Conflicts',
    between: groups => `${groups} take the same callers`,
    example: text => `For example ${text}`,
    knownCalls: value =>
      plural('en', value, { one: '# call in the journal', other: '# calls in the journal' }),
    keepIn: group => `Keep in «${group}»`,
    keepKnownIn: group => `Only the calls in the journal — to «${group}»`,
    none: 'No conflicts: every caller is in one group',
  },
  changes: {
    event: (event, name) => {
      switch (event.kind) {
        case 'member-added':
          return `Added to «${name(event.group)}»`;
        case 'excluded':
          return `Excluded from «${name(event.group)}»`;
        case 'member-removed':
          return `Removed from «${name(event.group)}»`;
        case 'exclusion-removed':
          return `Back in «${name(event.group)}»`;
        case 'my-contacts-excluded':
          return `«${name(event.group)}» now excludes my contacts`;
        case 'group-created':
          return `Group «${name(event.group)}» created`;
        case 'group-deleted':
          return 'Group deleted';
        case 'group-changed':
          return null;
        default:
          return assertNever(event);
      }
    },
    rejected: reason => {
      switch (reason) {
        case 'not-a-group-of-the-user':
          return 'Only your own groups take this';
        case 'strangers-take-nobody':
          return 'Callers land in «Strangers» by themselves';
        case 'nothing-to-move':
          return 'This call has neither a number nor a name';
        case 'not-a-contact':
          return 'Only contacts go to «My contacts»';
        case 'unknown-group':
          return 'The group is gone';
        default:
          return assertNever(reason);
      }
    },
  },
  schedule: EN_SCHEDULE,
  phrase: {
    always: action => `${action} always`,
    scheduled: (action, when, otherwise) =>
      `${action} ${when}; the rest of the time ${otherwise.toLowerCase()}`,
    allDay: 'all day',
    everyDay: 'every day',
    onWeekdays: 'on weekdays',
    onWeekends: 'at weekends',
    onDays: days => `on ${days}`,
    everyN: (value, unit) => `every ${count(value, unit, `${unit}s`)}`,
    monthly: 'monthly',
    yearly: 'yearly',
    once: date => `on ${date}`,
    exceptEvents: calendars => `except during ${calendars}`,
    onlyDuringEvents: calendars => `only during ${calendars}`,
    allTheTime: 'all the time',
    onlyAtPlaces: places => `only at ${places}`,
    exceptAtPlaces: places => `except at ${places}`,
    onClockOf: city => `(${city} time)`,
    localTime: '(local time)',
  },
  calendars: {
    title: 'Calendars',
    useOff: 'Off',
    useOnly: 'During events',
    useExcept: 'Outside events',
    unknownCalendar: 'a removed calendar',
    noPermission: 'Allow the calendar so a rule can look at your meetings',
    grant: 'Allow',
    ics: 'iCal links',
    addIcs: 'Add an iCal link',
    icsName: 'Name',
    icsUrl: 'Link (https://… .ics)',
    whereToGet:
      'Google Calendar: Settings → the calendar → «Secret address in iCal format». Outlook: Settings → Calendar → Shared calendars → Publish.',
    skipDeclined: 'Ignore declined invitations',
    includeAllDay: 'Count all-day events',
    upcoming: 'Next events',
    none: 'No calendars on this phone',
    noneHint:
      'Calendars of the Google accounts on the phone show up here — or add an iCal link below. Account already added? Open the Google Calendar app once: Android syncs its calendars after that.',
    addAccount: 'Add a Google account',
    phoneCalendars: 'Calendars on this phone',
    updated: when => `updated ${when}`,
    failed: 'not updated',
  },
  permissionPrompt: {
    title: {
      'screening-role': 'Let Calls Filter screen calls',
      contacts: 'Contacts',
      'call-log': 'Call history',
      'phone-state': 'End of a call',
      notifications: 'Notifications',
      calendar: 'Calendar',
      sms: 'SMS',
      location: 'Location',
      'background-location': 'Location all the time',
    },
    why: {
      'screening-role':
        'Android hands incoming calls only to the app chosen as the caller ID & spam app. Until then nothing is filtered.',
      contacts:
        'To know the people who call you: «My contacts», picking a contact, and calls from contacts reaching the filter at all.',
      'call-log': "To fill «Strangers» from the phone's history, calls before the app included.",
      'phone-state': "To ask «where does this number go?» once a stranger's call has ended.",
      notifications: 'For the pause, «where does this number go?», and when something goes wrong.',
      calendar: "A group follows your meetings: the app reads the phone's calendars for that.",
      sms: 'A group answers the contacts it turned away with an SMS.',
      location: 'To know whether you are at a place a group acts at — only for the places you set.',
      'background-location':
        'Android tells the app about entering and leaving a place even while it is closed — choose «Allow all the time».',
    },
    allow: 'Allow',
    openSettings: 'Open settings',
    inSettings: what =>
      `Android no longer asks by itself. In Settings, allow «${what}» — the app notices when you come back.`,
    roleInSettings:
      'Android no longer asks by itself. In Settings → Default apps → Caller ID & spam app, choose Calls Filter — the app notices when you come back.',
    later: 'Later',
  },
  place: EN_PLACE,
  check: EN_CHECK,
  sync: EN_SYNC,
  settings: {
    title: 'Settings',
    screening: 'Call screening',
    role: 'Screen calls',
    roleOn: 'On',
    roleOff: 'Off',
    permission: {
      contacts: 'Contacts',
      calendar: 'Calendar',
      'call-log': 'Call history',
      notifications: 'Notifications',
      'phone-state': 'End of a call',
      sms: 'SMS reply',
      location: 'Location',
      'background-location': 'Location all the time',
    },
    granted: 'Allowed',
    grant: 'Allow',
    language: 'Language',
    languageSystem: 'As the system',
    theme: 'Theme',
    themeSystem: 'As the system',
    themeLight: 'Light',
    themeDark: 'Dark',
    calendars: 'Calendars',
    diagnostics: 'Diagnostics',
    askWhereTo: 'Ask «where does this number go?» after a call',
    about: 'About',
  },
  diagnostics: {
    title: 'Diagnostics',
    shown: 'Show',
    journal: 'Keep the call log',
    journalDays: days => count(days, 'day', 'days'),
    share: 'Share',
    copy: 'Copy',
    copied: 'Copied',
    all: 'All',
    errors: 'Problems',
    empty: 'Nothing logged yet',
    summary: 'Summary',
    rulesetPublished: when => `Rules published ${when}`,
  },
  newGroup: {
    title: 'New group',
    name: 'Name',
    placeholder: 'Spam, Delivery, Work…',
    action: 'What to do with its calls',
    create: 'Create',
  },
  format: {
    time: (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dayMonth: (day, month) =>
      `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1] ?? ''}`,
    weekdayShort: weekday => WEEKDAYS[weekday],
  },
  numbering: EN_NUMBERING,
};
