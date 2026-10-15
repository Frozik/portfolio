import { cn } from '@frozik/components/components/cn';
import type { IListboxOption } from '@frozik/components/components/select/listbox-navigation';
import { Select } from '@frozik/components/components/select/Select';
import { isNil } from 'lodash-es';
import { memo, useMemo } from 'react';

import type { TBuiltinIcon } from '@frozik/vault/model/builtin-icons';
import { BUILTIN_ICON_GROUPS } from '@frozik/vault/model/builtin-icons';
import type { TCardColor, TCardIconRef } from '@frozik/vault/model/card';
import { CARD_COLORS } from '@frozik/vault/model/card-appearance';
import { getVaultReactTranslations } from '../translations/translations';
import { BUILTIN_ICON_COMPONENTS } from './builtin-icon-components';
import styles from './card-icon.module.css';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

const ICON_SIZE = 16;
const AUTO = 'auto';
const NO_COLOR = 'none';

type TIconChoice = typeof AUTO | TBuiltinIcon;
type TColorChoice = typeof NO_COLOR | TCardColor;

/**
 * A card's icon (automatic — the card network, the site's icon
 * or the template's — or a built-in one from its group) and, for a built-in
 * icon, the colour it is drawn in: the only icon a colour reaches.
 */
export const CardAppearancePicker = memo(
  ({
    color,
    icon,
    locale,
    onColorChange,
    onIconChange,
    autoPicture = null,
  }: {
    readonly color: TCardColor | null;
    readonly icon: TCardIconRef;
    readonly locale: string;
    readonly onColorChange: (color: TCardColor | null) => void;
    readonly onIconChange: (icon: TCardIconRef) => void;
    /** The site's icon the automatic choice shows, when the vault has one. */
    readonly autoPicture?: string | null;
  }) => {
    const t = getVaultReactTranslations(locale).appearance;

    const iconOptions = useMemo((): readonly IListboxOption<TIconChoice>[] => {
      const colorClass = isNil(color) ? undefined : styles[color];
      return [
        {
          value: AUTO,
          label: t.automatic,
          decoration: isNil(autoPicture) ? undefined : (
            <img className={styles.optionPicture} src={autoPicture} alt="" />
          ),
        },
        ...BUILTIN_ICON_GROUPS.flatMap(({ group, icons }) =>
          icons.map(name => {
            const Icon = BUILTIN_ICON_COMPONENTS[name];
            return {
              value: name,
              label: t.icons[name],
              group: t.iconGroups[group],
              decoration: (
                <span className={cn(styles.optionIcon, colorClass)}>
                  <Icon size={ICON_SIZE} />
                </span>
              ),
            };
          })
        ),
      ];
    }, [t, color, autoPicture]);

    const colorOptions = useMemo(
      (): readonly IListboxOption<TColorChoice>[] => [
        {
          value: NO_COLOR,
          label: t.noColor,
          decoration: <span className={cn(controlTokens.tokens, styles.swatch, styles.noColor)} />,
        },
        ...CARD_COLORS.map(option => ({
          value: option,
          label: t.colors[option],
          decoration: <span className={cn(controlTokens.tokens, styles.swatch, styles[option])} />,
        })),
      ],
      [t]
    );

    const iconChoice: TIconChoice | undefined =
      icon.kind === 'auto' ? AUTO : icon.kind === 'builtin' ? icon.name : undefined;

    return (
      <div className={styles.picker} data-testid="card-appearance">
        <div className={styles.pickerField}>
          <Select<TIconChoice>
            aria-label={t.icon}
            locale={locale}
            options={iconOptions}
            value={iconChoice}
            onValueChange={choice =>
              onIconChange(choice === AUTO ? { kind: 'auto' } : { kind: 'builtin', name: choice })
            }
          />
        </div>
        {icon.kind === 'builtin' && (
          <div className={styles.pickerField}>
            <Select<TColorChoice>
              aria-label={t.color}
              locale={locale}
              options={colorOptions}
              value={color ?? NO_COLOR}
              onValueChange={choice => onColorChange(choice === NO_COLOR ? null : choice)}
            />
          </div>
        )}
      </div>
    );
  }
);
