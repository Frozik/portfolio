import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { toBase64, utf8Text } from '@frozik/vault/crypto/bytes';
import type { TAssetId } from '@frozik/vault/model/ids';
import type { IAsset } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppModel } from '../app-model';
import { BottomSheet } from '../kit/BottomSheet';
import { IconButton } from '../kit/IconButton';
import { GAP, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

const BYTES_PER_KIB = 1024;
const THUMBNAIL_SIZE = 40;
const FILE_ICON_SIZE = 28;
/** A long log reads from its start; the rest is the file's, saved or sent whole. */
const TEXT_PREVIEW_MAX_CHARS = 100_000;
const PREVIEW_IMAGE_HEIGHT = 420;
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['txt', 'md', 'csv', 'json', 'log', 'xml']);
const TEXT_MIMES: ReadonlySet<string> = new Set(['application/json', 'application/xml']);

type TPreview = 'image' | 'text' | null;

/** Pictures Android draws itself, and text by its type or, for an import that knew only the name, its extension. */
function previewOf(asset: IAsset): TPreview {
  if (asset.mime.startsWith('image/') && asset.mime !== 'image/svg+xml') {
    return 'image';
  }
  const extension = asset.name.slice(asset.name.lastIndexOf('.') + 1).toLowerCase();
  return asset.mime.startsWith('text/') ||
    TEXT_MIMES.has(asset.mime) ||
    TEXT_EXTENSIONS.has(extension)
    ? 'text'
    : null;
}

const dataUriOf = (asset: IAsset, bytes: TBytes): string =>
  `data:${asset.mime};base64,${toBase64(bytes)}`;

const FileRow = observer(function FileRow({
  assetId,
  onPreview,
  onSaved,
}: {
  readonly assetId: TAssetId;
  readonly onPreview: (asset: IAsset, bytes: TBytes) => void;
  readonly onSaved: (outcome: { readonly name: string; readonly saved: boolean }) => void;
}) {
  const session = useSession();
  const { fileSavers } = useAppModel();
  const palette = usePalette();
  const t = useVaultTexts().files;
  const asset = session.document.assets.get(assetId);
  const file = session.files.fileOf(assetId);
  useEffect(() => {
    void session.files.request(assetId);
  }, [session, assetId]);
  if (file.kind === 'loading' || file.kind === 'idle') {
    return <Text style={[styles.detail, { color: palette.fgFaint }]}>{t.loading}</Text>;
  }
  if (isNil(asset) || file.kind === 'missing') {
    return <Notice tone="caution" message={t.missing} />;
  }
  const { bytes } = file;
  const preview = previewOf(asset);
  const save = async (to: 'saveToFolder' | 'share'): Promise<void> => {
    const outcome = await fileSavers[to]({ name: asset.name, mime: asset.mime, bytes });
    if (outcome !== 'cancelled' && to === 'saveToFolder') {
      onSaved({ name: asset.name, saved: outcome === 'saved' });
    }
  };
  return (
    <View testID="attached-file" style={styles.row}>
      {preview === 'image' ? (
        <Image source={{ uri: dataUriOf(asset, bytes) }} style={styles.thumbnail} />
      ) : (
        <MaterialIcons
          name={preview === 'text' ? 'description' : 'insert-drive-file'}
          size={FILE_ICON_SIZE}
          color={palette.fgDim}
          style={styles.fileIcon}
        />
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, { color: palette.fg }]}>
          {asset.name}
        </Text>
        <Text style={[styles.detail, { color: palette.fgFaint }]}>
          {t.size(Math.max(1, Math.round(bytes.byteLength / BYTES_PER_KIB)))}
        </Text>
      </View>
      <IconButton
        testID="attached-file-save"
        icon="download"
        label={t.save(asset.name)}
        onPress={() => void save('saveToFolder')}
      />
      <IconButton
        testID="attached-file-preview"
        icon="visibility"
        label={t.preview(asset.name)}
        onPress={() => (isNil(preview) ? void save('share') : onPreview(asset, bytes))}
      />
    </View>
  );
});

/**
 * A card's files: each by name and size, then two actions — save it into a folder the user picks,
 * and view it: a picture or a text here, anything else in an app that opens it.
 */
export function AttachedFiles({ assetIds }: { readonly assetIds: readonly TAssetId[] }) {
  const palette = usePalette();
  const t = useVaultTexts().files;
  const [shown, setShown] = useState<{ readonly asset: IAsset; readonly bytes: TBytes } | null>(
    null
  );
  const [saved, setSaved] = useState<{ readonly name: string; readonly saved: boolean } | null>(
    null
  );
  const kind = isNil(shown) ? null : previewOf(shown.asset);
  return (
    <View style={styles.list}>
      {assetIds.map(assetId => (
        <FileRow
          key={assetId}
          assetId={assetId}
          onPreview={(asset, bytes) => setShown({ asset, bytes })}
          onSaved={setSaved}
        />
      ))}
      {!isNil(saved) && (
        <Notice
          testID="attached-file-saved"
          tone={saved.saved ? 'info' : 'error'}
          message={saved.saved ? t.saved(saved.name) : t.notSaved}
        />
      )}
      <BottomSheet
        testID="attached-file-sheet"
        open={!isNil(shown)}
        title={shown?.asset.name ?? ''}
        onClose={() => setShown(null)}
      >
        {!isNil(shown) && kind === 'image' && (
          <Image
            testID="attached-file-image"
            source={{ uri: dataUriOf(shown.asset, shown.bytes) }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        )}
        {!isNil(shown) && kind === 'text' && (
          <ScrollView horizontal={false}>
            <Text
              testID="attached-file-text"
              selectable
              style={[styles.previewText, { color: palette.fg }]}
            >
              {(utf8Text(shown.bytes) ?? '').slice(0, TEXT_PREVIEW_MAX_CHARS)}
            </Text>
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  thumbnail: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, borderRadius: RADIUS / 2 },
  fileIcon: { width: THUMBNAIL_SIZE, textAlign: 'center' },
  text: { flex: 1, gap: 2 },
  name: { fontSize: TEXT_SIZE.body },
  detail: { fontSize: TEXT_SIZE.caption },
  previewImage: { width: '100%', height: PREVIEW_IMAGE_HEIGHT },
  previewText: { fontSize: TEXT_SIZE.small, fontFamily: 'monospace' },
});
