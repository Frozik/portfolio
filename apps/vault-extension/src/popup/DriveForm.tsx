import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import { DRIVE_VAULT_FOLDER, driveFolderOf } from '@frozik/vault/format/cloud-file-names';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import type { TDriveSearch } from '../domain/cloud';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

const SPACES: readonly TDriveSpace[] = ['my-drive', 'app-data'];

const FoundVaults = observer(
  ({
    model,
    found,
  }: {
    readonly model: PopupModel;
    readonly found: Extract<TDriveSearch, { kind: 'found' }>;
  }) =>
    found.paths.length === 0 ? (
      <p className={styles.notice}>{popupT.noDriveVaults}</p>
    ) : (
      <ul className={styles.list}>
        {found.paths.map(path => (
          <li key={path}>
            <button
              type="button"
              className={styles.item}
              disabled={model.busy}
              onClick={() =>
                void model.connectDrive({ space: found.space, path, account: found.account })
              }
            >
              {path}
            </button>
          </li>
        ))}
      </ul>
    )
);

/**
 * Google Drive: the space and folder, Google's sign-in, the vault files found
 * there — in the tab. In the popup only a button, which opens that tab.
 */
export const DriveForm = observer(({ model }: { readonly model: PopupModel }) => {
  const [space, setSpace] = useState<TDriveSpace>('my-drive');
  const [folder, setFolder] = useState<string>(DRIVE_VAULT_FOLDER);
  const find = useEventCallback(() => void model.findDriveVaults(space, folder));
  const { driveSearch, openInTab } = model;
  if (!isNil(openInTab)) {
    return (
      <>
        <p className={styles.notice}>
          {popupT.orDrive} {popupT.driveInTab}
        </p>
        <button type="button" className={styles.button} onClick={openInTab}>
          {popupT.connectDrive}
        </button>
      </>
    );
  }
  return (
    <>
      <label className={styles.label}>
        {popupT.driveSpace}
        <Select<TDriveSpace>
          aria-label={popupT.driveSpace}
          options={SPACES.map(value => ({ value, label: popupT.spaces[value] }))}
          value={space}
          onValueChange={setSpace}
          locale={navigator.language}
        />
      </label>
      {space === 'my-drive' && (
        <label className={styles.label}>
          {popupT.driveFolder}
          <TextEditor
            aria-label={popupT.driveFolder}
            placeholder={DRIVE_VAULT_FOLDER}
            value={folder}
            onValueChange={setFolder}
          />
        </label>
      )}
      <button
        type="button"
        className={styles.primary}
        disabled={(space === 'my-drive' && isNil(driveFolderOf(folder))) || model.busy}
        onClick={find}
      >
        {popupT.findInDrive}
      </button>
      {driveSearch?.kind === 'failed' && (
        <p className={styles.error}>
          {popupT.driveFailures[driveSearch.reason]}
          {!isNil(driveSearch.detail) && (
            <>
              <br />
              <span className={styles.value}>{driveSearch.detail}</span>
            </>
          )}
        </p>
      )}
      {driveSearch?.kind === 'found' && <FoundVaults model={model} found={driveSearch} />}
    </>
  );
});
