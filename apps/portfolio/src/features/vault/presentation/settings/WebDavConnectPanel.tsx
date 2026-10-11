import type { IWebDavFeatures } from '@frozik/cloud-storage/webdav/webdav-features';
import { WEBDAV_PRESETS } from '@frozik/cloud-storage/webdav/webdav-presets';
import type { TWebDavProbeFailure } from '@frozik/cloud-storage/webdav/webdav-probe';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { WebDavConnectForm } from '../../application/WebDavConnectForm';
import { VaultField } from '../components/VaultField';
import { cloudT } from '../translations/cloud';
import { corsSnippetOf, WEBDAV_SERVERS } from './cors-snippets';
import type { TCloudPanelAction } from './FoundVaults';
import { FoundVaults } from './FoundVaults';

const CUSTOM_SERVICE = 'custom';

function failureText(failure: TWebDavProbeFailure): string {
  const failures = cloudT.webdav.failures;
  return failure.kind === 'server' ? failures.server(failure.status) : failures[failure.kind];
}

const CorsSnippets = memo(() => {
  const t = cloudT.webdav;
  const origin = window.location.origin;
  return (
    <div className="flex flex-col gap-2">
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
          <li>{features.conditionalRequests ? t.atomic : t.checkThenWrite}</li>
          <li>{features.moveReplace ? t.moveReplace : t.noMoveReplace}</li>
          {features.revisionKind === 'last-modified' && <li>{t.lastModified}</li>}
        </ul>
      }
    />
  );
});

const CheckOutcome = observer(
  ({ form, action }: { readonly form: WebDavConnectForm; readonly action: TCloudPanelAction }) => {
    const { check } = form;
    switch (check.kind) {
      case 'unchecked':
        return null;
      case 'checking':
        return <p className="text-[13px] text-landing-fg-dim">{cloudT.webdav.checking}</p>;
      case 'reachable':
        return (
          <div className="flex flex-col gap-3">
            <Findings features={check.reach.features} />
            <FoundVaults vaults={check.reach.vaults} action={action} />
          </div>
        );
      case 'failed':
        return (
          <div className="flex flex-col gap-3">
            <Alert type="error" message={failureText(check.failure)} />
            {check.failure.kind === 'cors-blocked' && <CorsSnippets />}
          </div>
        );
      default:
        return assertNever(check);
    }
  }
);

/**
 * The folder, the login and
 * an app password, and "Check" runs the probe; when the page cannot reach
 * the server it shows how to allow this site on the usual servers.
 */
export const WebDavConnectPanel = observer(
  ({
    form,
    action,
    onClose,
  }: {
    readonly form: WebDavConnectForm;
    readonly action: TCloudPanelAction;
    readonly onClose: () => void;
  }) => {
    const t = cloudT.webdav;
    const locale = getCurrentLanguage();
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
              locale={locale}
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
              locale={locale}
            />
          )}
        </VaultField>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={!form.canCheck || form.check.kind === 'checking'}
            onClick={() => void form.runCheck()}
          >
            {t.check}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.cancel}
          </Button>
        </div>
        <CheckOutcome form={form} action={action} />
      </div>
    );
  }
);
