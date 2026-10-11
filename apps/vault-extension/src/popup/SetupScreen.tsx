import type { IWebDavPreset } from '@frozik/cloud-storage/webdav/webdav-presets';
import {
  presetEndpoint,
  WEBDAV_PRESETS,
  webDavPresetOf,
} from '@frozik/cloud-storage/webdav/webdav-presets';
import { FileDrop } from '@frozik/components/components/file-drop/FileDrop';
import type { IPickedFile } from '@frozik/components/components/file-drop/FileDrop';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { PopupModel } from '../application/PopupModel';
import { popupT } from './popup-texts';
import styles from './popup.module.css';

const CUSTOM_SERVICE = 'custom';

/** A WebDAV folder, its user and app password, and the vault file in it. */
const WebDavForm = observer(({ model }: { readonly model: PopupModel }) => {
  const [preset, setPreset] = useState<IWebDavPreset | null>(null);
  const [server, setServer] = useState('');
  const [typedUrl, setTypedUrl] = useState('');
  const [username, setUsername] = useState('');
  const folderUrl = isNil(preset) ? typedUrl : presetEndpoint(preset, { username, server });
  const typeUrl = useEventCallback((url: string) => {
    setPreset(null);
    setTypedUrl(url);
  });
  const choose = useEventCallback((id: string) => {
    setTypedUrl(folderUrl);
    setPreset(webDavPresetOf(id) ?? null);
  });
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const ready = [folderUrl, username, password, fileName].every(value => value.trim() !== '');
  const connect = useEventCallback(() => {
    if (ready) {
      void model.connectWebDav(
        { folderUrl: folderUrl.trim(), username: username.trim(), fileName: fileName.trim() },
        password
      );
    }
  });
  const { notice } = model;
  return (
    <>
      <p className={styles.notice}>{popupT.orWebDav}</p>
      <Select<string>
        aria-label={popupT.service}
        options={[
          { value: CUSTOM_SERVICE, label: popupT.customService },
          ...WEBDAV_PRESETS.map(option => ({
            value: option.id,
            label: option.name,
            group: option.hosting === 'self-hosted' ? popupT.selfHosted : popupT.hosted,
          })),
        ]}
        value={preset?.id ?? CUSTOM_SERVICE}
        onValueChange={choose}
        locale={navigator.language}
      />
      {preset?.hosting === 'self-hosted' && (
        <TextEditor
          aria-label={popupT.server}
          placeholder={popupT.server}
          value={server}
          onValueChange={setServer}
        />
      )}
      <TextEditor
        aria-label={popupT.folderUrl}
        placeholder="https://cloud.example.org/remote.php/dav/files/me/Vault/"
        value={folderUrl}
        onValueChange={typeUrl}
      />
      <TextEditor
        aria-label={popupT.username}
        placeholder={popupT.username}
        value={username}
        onValueChange={setUsername}
      />
      <SecretEditor
        aria-label={popupT.appPassword}
        placeholder={popupT.appPassword}
        autoComplete="off"
        value={password}
        onValueChange={setPassword}
      />
      <TextEditor
        aria-label={popupT.fileName}
        placeholder="Family.pwv"
        value={fileName}
        onValueChange={setFileName}
      />
      <button
        type="button"
        className={styles.primary}
        disabled={!ready || model.busy}
        onClick={connect}
      >
        {popupT.connect}
      </button>
      {notice?.kind === 'host-refused' && <p className={styles.error}>{popupT.hostRefused}</p>}
      {notice?.kind === 'connect-failed' && (
        <p className={styles.error}>{popupT.connectFailures[notice.outcome]}</p>
      )}
    </>
  );
});

/** No vault yet: a vault file from disk or from a WebDAV folder becomes the extension's copy. */
export const SetupScreen = observer(({ model }: { readonly model: PopupModel }) => {
  const take = useEventCallback((files: readonly IPickedFile[]) => {
    const [file] = files;
    if (!isNil(file)) {
      void model.openFile(file.bytes, file.name);
    }
  });
  return (
    <>
      <p className={styles.notice}>{popupT.setupIntro}</p>
      <FileDrop accept=".pwv" onFiles={take} aria-label={popupT.chooseFile}>
        {popupT.chooseFile}
      </FileDrop>
      {model.notice?.kind === 'file-refused' && (
        <p className={styles.error}>{popupT.fileRefused}</p>
      )}
      <WebDavForm model={model} />
    </>
  );
});
