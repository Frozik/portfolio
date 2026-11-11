import { BUILTIN_ICON_GROUPS } from '@frozik/vault/model/builtin-icons';
import type { ICardState, TCardColor, TCardIconRef } from '@frozik/vault/model/card';
import { CARD_COLOR_SHADES } from '@frozik/vault/model/card-appearance';
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
import { ColorSwatches } from './ColorSwatches';

const GLYPH_SIZE = 22;

/**
 * The card's icon (automatic, or a built-in one from its group) and its colour: a built-in icon is
 * drawn in it, an automatic one — a network's logo, a site's icon — sits on it.
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
      <ColorSwatches value={color} onChange={onColorChange} testIDPrefix="card-color" />
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
