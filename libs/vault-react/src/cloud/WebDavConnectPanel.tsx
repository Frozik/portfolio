import type { IWebDavFeatures } from '@frozik/cloud-storage/webdav/webdav-features';
import { WEBDAV_PRESETS } from '@frozik/cloud-storage/webdav/webdav-presets';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { WebDavConnectForm } from '@frozik/vault-app/cloud/application/WebDavConnectForm';
import { webDavFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { VaultField } from '../form/VaultField';
import { cloudT } from '../texts/cloud';
import { LANGUAGE } from '../texts/language';
import { corsSnippetOf, WEBDAV_SERVERS } from './cors-snippets';
import type { TCloudPanelAction } from './FoundVaults';
import { FoundVaults } from './FoundVaults';

const CUSTOM_SERVICE = 'custom';

const CorsSnippets = memo(() => {
  const t = cloudT.webdav;
  const origin = window.location.origin;
  return (
    <div className="flex flex-col gap-2" data-testid="cors-snippets">
      {WEBDAV_SERVERS.map(server => (
        <details key={server} className="rounded-md border border-landing-border">
          <summary className="cursor-pointer px-3 py-2 text-[13px] text-landing-fg">
            {t.corsFor[server]}
          </summary>
          <pre className="overflow-x-auto rounded-b-md bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-landing-fg">
            <code>{corsSnippetOf(server, origin)}</code>
          </pre>
        </details>
      ))}
    </div>
  );
});

const Findings = memo(({ features }: { readonly features: IWebDavFeatures }) => {
  const t = cloudT.webdav;
  return (
    <Alert
      type="success"
      message={t.reachable}
      description={
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li
            data-testid="webdav-writes"
            data-state={features.conditionalRequests ? 'atomic' : 'check-then-write'}
          >
            {features.conditionalRequests ? t.atomic : t.checkThenWrite}
          </li>
          <li>{features.moveReplace ? t.moveReplace : t.noMoveReplace}</li>
          {features.revisionKind === 'last-modified' && <li>{t.lastModified}</li>}
        </ul>
      }
    />
  );
});

const CheckProgress = observer(({ form }: { readonly form: WebDavConnectForm }) => {
  const { check } = form;
  switch (check.kind) {
    case 'unchecked':
    case 'reachable':
      return null;
    case 'checking':
      return <p className="text-[13px] text-landing-fg-dim">{cloudT.webdav.checking}</p>;
    case 'failed':
      return (
        <div className="flex flex-col gap-3">
          <Alert
            type="error"
            message={webDavFailureText(cloudT, check.failure)}
            data-testid={`webdav-${check.failure.kind}`}
          />
          {check.failure.kind === 'cors-blocked' && <CorsSnippets />}
        </div>
      );
    default:
      return assertNever(check);
  }
});

/** What the check found in the folder: how safely the server writes, the vaults there, what to do. */
export const WebDavVaults = observer(
  ({ form, action }: { readonly form: WebDavConnectForm; readonly action: TCloudPanelAction }) => {
    const { check } = form;
    if (check.kind !== 'reachable') {
      return null;
    }
    return (
      <div className="flex flex-col gap-3">
        <Findings features={check.reach.features} />
        <FoundVaults vaults={check.reach.vaults} action={action} />
      </div>
    );
  }
);

/**
 * The folder, the login and
 * an app password, and "Check" runs the probe; when the page cannot reach
 * the server it shows how to allow this site on the usual servers.
 */
export const WebDavConnectPanel = observer(({ form }: { readonly form: WebDavConnectForm }) => {
  const t = cloudT.webdav;
  const { addressProblem } = form;
  const addressError =
    form.endpoint !== '' && !isNil(addressProblem) ? t.addressProblems[addressProblem] : null;

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-[15px] font-medium text-landing-fg">{t.title}</h4>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      <VaultField label={t.service}>
        {describedBy => (
          <Select<string>
            aria-label={t.service}
            aria-describedby={describedBy}
            options={[
              { value: CUSTOM_SERVICE, label: t.customService },
              ...WEBDAV_PRESETS.map(preset => ({
                value: preset.id,
                label: preset.name,
                group: preset.hosting === 'self-hosted' ? t.selfHosted : t.hosted,
              })),
            ]}
            value={form.preset?.id ?? CUSTOM_SERVICE}
            onValueChange={id => form.setPreset(id === CUSTOM_SERVICE ? null : id)}
            locale={LANGUAGE}
          />
        )}
      </VaultField>
      {form.preset?.hosting === 'hosted' && <Alert type="info" message={t.hostedNoBrowser} />}
      {form.preset?.hosting === 'self-hosted' && (
        <VaultField label={t.server} hint={t.serverHint}>
          {describedBy => (
            <TextEditor
              aria-label={t.server}
              aria-describedby={describedBy}
              value={form.server}
              onValueChange={form.setServer}
            />
          )}
        </VaultField>
      )}
      <VaultField label={t.address} hint={t.addressHint} error={addressError}>
        {describedBy => (
          <TextEditor
            aria-label={t.address}
            aria-describedby={describedBy}
            aria-invalid={!isNil(addressError)}
            value={form.endpoint}
            onValueChange={form.setEndpoint}
          />
        )}
      </VaultField>
      <VaultField label={t.username}>
        {describedBy => (
          <TextEditor
            aria-label={t.username}
            aria-describedby={describedBy}
            value={form.username}
            onValueChange={form.setUsername}
          />
        )}
      </VaultField>
      <VaultField label={t.password} hint={t.passwordHint}>
        {describedBy => (
          <SecretEditor
            aria-label={t.password}
            aria-describedby={describedBy}
            autoComplete="off"
            value={form.password}
            onValueChange={form.setPassword}
            onEnter={() => void form.runCheck()}
            locale={LANGUAGE}
          />
        )}
      </VaultField>
      <Button
        type="button"
        className="self-start"
        disabled={!form.canCheck || form.check.kind === 'checking'}
        onClick={() => void form.runCheck()}
      >
        {t.check}
      </Button>
      <CheckProgress form={form} />
    </div>
  );
});
