import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import type { ReactNode } from 'react';

import { settingsT } from '../texts/settings';

/** What the vault is built on: the file format, the credits, and what an app adds (its version). */
export function AboutSection({ children }: { readonly children?: ReactNode }) {
  const t = settingsT;
  return (
    <>
      <h3 className="text-[16px] font-medium text-landing-fg">{t.about}</h3>
      {children}
      <p className="text-[13px] text-landing-fg-dim">{t.formatVersion(CURRENT_SCHEMA_VERSION)}</p>
      <span className="text-[13px] font-medium text-landing-fg">{t.credits}</span>
      <ul className="list-disc pl-5 text-[12px] text-landing-fg-dim">
        {t.creditsList.map(credit => (
          <li key={credit}>{credit}</li>
        ))}
      </ul>
    </>
  );
}
