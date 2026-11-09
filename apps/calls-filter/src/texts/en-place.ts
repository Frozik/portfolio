import type { ITexts } from './texts';

/** The place editor's words: the map, the radius, the phone's state at a place. */
export const EN_PLACE: ITexts['place'] = {
  title: 'Location',
  add: 'Add a place',
  name: 'Name',
  namePlaceholder: 'Office, Home…',
  onlyAt: 'Only here',
  exceptAt: 'Except here',
  radius: meters => (meters < 1_000 ? `${meters} m` : `${meters / 1_000} km`),
  radiusSmall: 'Android notices 50 m unreliably; 100 m or more is safer',
  search: 'Address',
  find: 'Find',
  here: 'Where I am',
  hereUnknown: 'The phone cannot tell where it is right now — tap the map or find the address',
  save: 'Save the place',
  remove: 'Remove the place',
  at: 'you are here',
  away: 'you are elsewhere',
  unknown: 'location unknown — the place does not count now',
};
