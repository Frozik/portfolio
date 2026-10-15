import { BUILTIN_ICON_GROUPS } from '@frozik/vault/model/builtin-icons';
import type { ICardState, TCardColor, TCardIconRef } from '@frozik/vault/model/card';
import { CARD_COLOR_SHADES, CARD_COLORS } from '@frozik/vault/model/card-appearance';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BUILTIN_ICON_COMPONENTS } from '../card-icon/builtin-icon-components';
import { CardIcon } from '../card-icon/CardIcon';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { GAP, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useEditorTexts, useWidgetTexts } from '../texts';
import { usePalette, useScheme } from '../theme/AppTheme';

const GLYPH_SIZE = 22;
const SWATCH_SIZE = 32;
/** A swatch is drawn small but touched at full size. */
const SWATCH_SLOP = (TOUCH_SIZE - SWATCH_SIZE) / 2;

/**
 * The card's icon (automatic, or a built-in one from its group) and, for a built-in icon, the
 * colour it is drawn in: the only icon a colour reaches.
 */
export function AppearancePicker({
  card,
  siteIcon,
  onIconChange,
  onColorChange,
}: {
  readonly card: ICardState;
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
  readonly onIconChange: (icon: TCardIconRef) => void;
  readonly onColorChange: (color: TCardColor | null) => void;
}) {
  const palette = usePalette();
  const scheme = useScheme();
  const t = useWidgetTexts().appearance;
  const label = useEditorTexts().appearance;
  const [choosing, setChoosing] = useState(false);
  const { icon, color } = card;
  const choose = (next: TCardIconRef): void => {
    setChoosing(false);
    onIconChange(next);
  };
  return (
    <View style={styles.picker}>
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      <Pressable
        testID="card-icon-choice"
        accessibilityRole="button"
        accessibilityLabel={t.icon}
        onPress={() => setChoosing(true)}
        style={[styles.choice, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
      >
        <CardIcon card={card} siteIcon={siteIcon} />
        <Text style={[styles.choiceText, { color: palette.fg }]}>
          {icon.kind === 'builtin' ? t.icons[icon.name] : t.automatic}
        </Text>
      </Pressable>
      {icon.kind === 'builtin' && (
        <View accessibilityRole="radiogroup" accessibilityLabel={t.color} style={styles.swatches}>
          {[null, ...CARD_COLORS].map(option => {
            const selected = option === color;
            return (
              <Pressable
                key={option ?? 'none'}
                testID={`card-color-${option ?? 'none'}`}
                accessibilityRole="radio"
                accessibilityLabel={isNil(option) ? t.noColor : t.colors[option]}
                accessibilityState={{ selected }}
                onPress={() => onColorChange(option)}
                hitSlop={SWATCH_SLOP}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: isNil(option)
                      ? palette.bgElevated
                      : CARD_COLOR_SHADES[option][scheme],
                    borderColor: selected ? palette.accent : palette.line,
                  },
                  selected && styles.swatchSelected,
                ]}
              />
            );
          })}
        </View>
      )}
      <Dialog open={choosing} title={t.icon} onClose={() => setChoosing(false)}>
        <Button
          testID="icon-option-auto"
          variant={icon.kind === 'auto' ? 'primary' : 'secondary'}
          label={t.automatic}
          onPress={() => choose({ kind: 'auto' })}
        />
        <ScrollView>
          {BUILTIN_ICON_GROUPS.map(({ group, icons }) => (
            <View key={group} style={styles.group}>
              <Text style={[styles.groupTitle, { color: palette.fgFaint }]}>
                {t.iconGroups[group]}
              </Text>
              <View style={styles.grid}>
                {icons.map(name => {
                  const Glyph = BUILTIN_ICON_COMPONENTS[name];
                  const selected = icon.kind === 'builtin' && icon.name === name;
                  return (
                    <Pressable
                      key={name}
                      testID={`icon-option-${name}`}
                      accessibilityRole="button"
                      accessibilityLabel={t.icons[name]}
                      accessibilityState={{ selected }}
                      onPress={() => choose({ kind: 'builtin', name })}
                      style={[
                        styles.option,
                        { borderColor: selected ? palette.accent : 'transparent' },
                      ]}
                    >
                      <Glyph
                        size={GLYPH_SIZE}
                        color={isNil(color) ? palette.fg : CARD_COLOR_SHADES[color][scheme]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 6 },
  label: { fontSize: TEXT_SIZE.small },
  choice: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: RADIUS,
  },
  choiceText: { fontSize: TEXT_SIZE.body },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: SWATCH_SLOP * 2 },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: 1,
  },
  swatchSelected: { borderWidth: 3 },
  group: { gap: 6, marginTop: GAP },
  groupTitle: { fontSize: TEXT_SIZE.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  option: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    borderWidth: 2,
  },
});
