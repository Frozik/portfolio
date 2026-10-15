import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAppModel } from '../app-model';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/** The vault's name and description, which the list of vaults shows before any unlock. */
export const VaultTitleSection = observer(function VaultTitleSection() {
  const { app } = useAppModel();
  const session = useSession();
  const palette = usePalette();
  const t = useSettingsTexts();
  const { settings } = session.document;
  const [name, setName] = useState(settings.name);
  const [description, setDescription] = useState(settings.description);
  const changed = name.trim() !== settings.name || description.trim() !== settings.description;
  return (
    <>
      <TextField testID="vault-name" label={t.name} value={name} onChangeText={setName} />
      <TextField
        testID="vault-description"
        label={t.description}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.descriptionHint}</Text>
      <Button
        testID="vault-rename"
        variant="secondary"
        label={t.saveTitle}
        disabled={!changed || name.trim() === ''}
        onPress={() => void app.renameVault({ name: name.trim(), description: description.trim() })}
      />
    </>
  );
});

const styles = StyleSheet.create({
  hint: { fontSize: TEXT_SIZE.caption },
});
