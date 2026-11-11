import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { CARD_COLOR_SHADES } from '@frozik/vault/model/card-appearance';
import type { TBuiltinGroupId } from '@frozik/vault/model/smart-groups';
import { isNil } from 'lodash-es';
import type { ComponentProps } from 'react';

import type { TSectionEntry } from '@frozik/vault-app/document/application/section-entries';

import { usePalette, useScheme } from '../theme/AppTheme';

type TIconName = ComponentProps<typeof MaterialIcons>['name'];

const BUILTIN_ICONS: Readonly<Record<TBuiltinGroupId, TIconName>> = {
  all: 'apps',
  favorites: 'star',
  recent: 'history',
  'bank-cards': 'credit-card',
  notes: 'description',
  'with-otp': 'timelapse',
  expiring: 'schedule',
  expired: 'event-busy',
  'no-group': 'label-off',
  problems: 'report-problem',
  duplicates: 'content-copy',
  protected: 'shield',
  archive: 'archive',
  trash: 'delete-outline',
};

const ICON_SIZE = 22;

/** A section's mark: its own glyph for a built-in one, a label in the label's colour for the user's. */
export function SectionIcon({ entry }: { readonly entry: TSectionEntry }) {
  const palette = usePalette();
  const scheme = useScheme();
  switch (entry.kind) {
    case 'builtin':
      return (
        <MaterialIcons
          name={BUILTIN_ICONS[entry.section]}
          size={ICON_SIZE}
          color={entry.section === 'favorites' ? palette.caution : palette.fgDim}
        />
      );
    case 'smart':
      return <MaterialIcons name="auto-awesome" size={ICON_SIZE} color={palette.fgDim} />;
    case 'group':
      return isNil(entry.color) ? (
        <MaterialIcons name="label-outline" size={ICON_SIZE} color={palette.fgDim} />
      ) : (
        <MaterialIcons
          name="label"
          size={ICON_SIZE}
          color={CARD_COLOR_SHADES[entry.color][scheme]}
        />
      );
    default:
      return assertNever(entry);
  }
}
