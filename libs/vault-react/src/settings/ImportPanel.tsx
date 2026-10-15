import { FileDrop } from '@frozik/components/components/file-drop/FileDrop';
import type { IPickedFile } from '@frozik/components/components/file-drop/FileDrop';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TDuplicatePolicy } from '@frozik/vault/import/apply-import';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import type { IImportPreview } from '@frozik/vault/import/preview-import';
import type { TTemplateId } from '@frozik/vault/model/ids';
import { templateOf } from '@frozik/vault/model/templates/registry';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { RadioGroup } from '@frozik/components/ui/RadioGroup';
import type { VaultImport } from '@frozik/vault-app/interchange/application/VaultImport';
import {
  importWarningText,
  sourcePasswordTexts,
} from '@frozik/vault-app/texts/interchange/data-wording';
import { VaultField } from '../form/VaultField';
import { dataT } from '../texts/data';
import { LANGUAGE } from '../texts/language';
import { translateTemplateKey } from '../texts/templates';
import { vaultT } from '../texts/vault';

const ACCEPTED =
  '.csv,.json,.xml,.pwv,.kdbx,.db,.zip,text/csv,application/json,text/xml,application/xml,application/zip,image/*';
const IMAGE_TYPE = 'image/';
const DUPLICATE_POLICIES: readonly TDuplicatePolicy[] = ['skip', 'replace', 'keep-both'];

const Preview = observer(
  ({
    flow,
    batch,
    preview,
    importing,
  }: {
    readonly flow: VaultImport;
    readonly batch: IImportBatch;
    readonly preview: IImportPreview;
    readonly importing: boolean;
  }) => {
    const t = dataT.import;
    const counts = Object.entries(preview.byTemplate).map(([id, count]) => (
      <li key={id}>
        {translateTemplateKey(templateOf(id as TTemplateId).nameKey)}: {count}
      </li>
    ));
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-landing-fg">
          {t.found(t.sources[batch.source], preview.cards)}
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-landing-fg-dim">
          {counts}
        </ul>
        {batch.warnings.length > 0 && (
          <Alert
            type="warning"
            message={
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {batch.warnings.map(warning => (
                  <li key={JSON.stringify(warning)}>{importWarningText(dataT, warning)}</li>
                ))}
              </ul>
            }
          />
        )}
        {preview.duplicates > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-landing-fg">{t.duplicates(preview.duplicates)}</p>
            <RadioGroup
              options={DUPLICATE_POLICIES.map(value => ({
                value,
                label: t.duplicateChoices[value],
              }))}
              value={flow.duplicates}
              onChange={flow.setDuplicates}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            data-testid="import-apply"
            disabled={importing}
            onClick={() => void flow.confirm()}
          >
            {importing ? t.importing : t.confirm}
          </Button>
          <Button type="button" variant="secondary" onClick={flow.reset}>
            {t.cancel}
          </Button>
        </div>
      </div>
    );
  }
);

/** A KeePass key file: picked once, named, removable; never stored. */
const KeyFile = observer(({ flow }: { readonly flow: VaultImport }) => {
  const t = dataT.import;
  const pick = useEventCallback((files: readonly IPickedFile[]) => {
    const [file] = files;
    if (!isNil(file)) {
      flow.setKeyFile({ name: file.name, bytes: file.bytes });
    }
  });
  const clear = useEventCallback(() => flow.setKeyFile(null));
  if (!isNil(flow.keyFile)) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-landing-fg">
        <span>{t.keyFileChosen(flow.keyFile.name)}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          {t.keyFileRemove}
        </Button>
      </div>
    );
  }
  return (
    <FileDrop onFiles={pick} locale={LANGUAGE} aria-label={t.keyFile}>
      {t.keyFile}
    </FileDrop>
  );
});

const VaultPassword = observer(({ flow }: { readonly flow: VaultImport }) => {
  const t = dataT.import;
  const { step } = flow;
  if (step.kind !== 'vault-password') {
    return null;
  }
  const open = (): void => void flow.openVaultFile();
  const keePass = step.source.format === 'kdbx';
  const { label, hint } = sourcePasswordTexts(dataT, step.source.format);
  return (
    <div
      className="flex flex-col gap-3"
      data-testid="import-password"
      data-state={step.failure ?? 'asking'}
    >
      <VaultField
        label={label}
        hint={hint}
        error={isNil(step.failure) ? null : vaultT.unlock.failures[step.failure]}
      >
        {describedBy => (
          <SecretEditor
            aria-label={label}
            aria-describedby={describedBy}
            autoComplete="off"
            value={flow.vaultPassword}
            onValueChange={flow.setVaultPassword}
            onEnter={open}
            locale={LANGUAGE}
          />
        )}
      </VaultField>
      {keePass && <KeyFile flow={flow} />}
      <div className="flex gap-2">
        <Button type="button" data-testid="import-open" disabled={!flow.canOpen} onClick={open}>
          {step.opening ? t.opening : t.open}
        </Button>
        <Button type="button" variant="secondary" onClick={flow.reset}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
});

/** A file in, a preview with the duplicate choice, then one confirmed import. */
export const ImportPanel = observer(({ flow }: { readonly flow: VaultImport }) => {
  const t = dataT.import;
  const { step } = flow;
  const take = useEventCallback((files: readonly IPickedFile[]) => {
    const [file] = files;
    if (isNil(file)) {
      return;
    }
    if (file.type.startsWith(IMAGE_TYPE)) {
      void flow.chooseImage({ bytes: file.bytes, mime: file.type });
    } else {
      void flow.choose(file.bytes);
    }
  });
  const drop = (
    <FileDrop accept={ACCEPTED} onFiles={take} locale={LANGUAGE} aria-label={t.title}>
      {t.drop}
    </FileDrop>
  );

  const body = (() => {
    switch (step.kind) {
      case 'choosing':
        return drop;
      case 'failed':
        return (
          <>
            <Alert type="error" message={t.failures[step.error]} />
            {drop}
          </>
        );
      case 'vault-password':
        return <VaultPassword flow={flow} />;
      case 'preview':
        return (
          <Preview
            flow={flow}
            batch={step.batch}
            preview={step.preview}
            importing={step.importing}
          />
        );
      case 'done': {
        const { added, replaced, skipped, filesDropped } = step.outcome;
        return (
          <div className="flex flex-col gap-3">
            <Alert
              type="success"
              message={t.done(added, replaced, skipped)}
              description={filesDropped > 0 ? t.filesDropped(filesDropped) : undefined}
            />
            <Button type="button" variant="secondary" className="self-start" onClick={flow.reset}>
              {t.another}
            </Button>
          </div>
        );
      }
      default:
        return assertNever(step);
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[15px] font-medium text-landing-fg">{t.title}</h4>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      {body}
    </div>
  );
});
