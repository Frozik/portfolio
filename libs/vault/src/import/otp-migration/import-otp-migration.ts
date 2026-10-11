import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import type { IOtpParams } from '../../model/validation/otpauth-uri';
import { formatOtpUri } from '../../model/validation/otpauth-uri';
import type { IImportBatch } from '../imported-card';
import { keyLabel } from '../imported-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';

/** Google Authenticator's transfer: one internet account per code, named by its issuer. */
export function importOtpMigration(entries: readonly IOtpParams[]): IImportBatch {
  return {
    source: 'authenticator',
    cards: entries.map(entry =>
      plainCard(
        INTERNET_ACCOUNT_TEMPLATE,
        entry.issuer ?? entry.label,
        templateTabs(INTERNET_ACCOUNT_TEMPLATE, { 'field.login': fill(entry.label) }, [
          extraField('otp', keyLabel('field.oneTimeCode'), formatOtpUri(entry)),
        ])
      )
    ),
    links: [],
    assets: [],
    warnings: [],
  };
}
